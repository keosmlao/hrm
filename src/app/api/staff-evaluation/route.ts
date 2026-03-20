import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

function getPreviousMonth() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month === 0) return { year: String(year - 1), month: 12 };
  return { year: String(year), month };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  const employee = session?.employee;
  if (!employee) {
    return NextResponse.json({
      employeeCode: "",
      employeeName: "",
      selfEval: null,
      myEvals: [],
      targets: [],
      isManager: false,
      currentMonth: getPreviousMonth().month,
      currentYear: getPreviousMonth().year,
      availableMonths: [],
      completedSelfMonths: [],
    });
  }

  const previousMonth = getPreviousMonth();
  const year = request.nextUrl.searchParams.get("year") || previousMonth.year;
  const month = Number(request.nextUrl.searchParams.get("month")) || previousMonth.month;

  try {
    const [criteriaRes, selfEvalRes, evalsRes, completedSelfMonthsRes] = await Promise.all([
      pool.query(
        "SELECT * FROM odg_staff_eval_criteria ORDER BY question_order ASC, option_id ASC"
      ),
      pool.query(
        `SELECT * FROM odg_staff_evaluation
         WHERE evaluator_code = $1 AND target_code = $1 AND year = $2 AND month = $3
         LIMIT 1`,
        [employee.employeeCode, year, month]
      ),
      pool.query(
        `SELECT * FROM odg_staff_evaluation
         WHERE evaluator_code = $1 AND target_code != $1 AND year = $2 AND month = $3
         ORDER BY created_at DESC`,
        [employee.employeeCode, year, month]
      ),
      pool.query(
        `SELECT year, month
         FROM odg_staff_evaluation
         WHERE evaluator_code = $1 AND target_code = $1`,
        [employee.employeeCode]
      ),
    ]);

    const evals = evalsRes.rows;
    const targetCodes = [...new Set(evals.map((row: Record<string, unknown>) => row.target_code as string))];
    let targetEmployees: { employee_code: string; fullname_lo: string }[] = [];
    if (targetCodes.length > 0) {
      const { rows } = await pool.query(
        "SELECT employee_code, fullname_lo FROM odg_employee WHERE employee_code = ANY($1)",
        [targetCodes]
      );
      targetEmployees = rows;
    }

    const nameMap = new Map(
      targetEmployees.map((targetEmployee) => [targetEmployee.employee_code, targetEmployee.fullname_lo])
    );
    const evalsWithNames = evals.map((evaluation: Record<string, unknown>) => ({
      ...evaluation,
      target_name: nameMap.get(evaluation.target_code as string) ?? null,
    }));

    const isManager = ["11", "12"].includes(employee.positionCode);
    let targets: { employee_code: string; fullname_lo: string; source: string }[] = [];

    if (isManager) {
      const posNotIn = employee.positionCode === "11" ? ["11"] : ["11", "12"];
      const [teamRes, assignedRes] = await Promise.all([
        pool.query(
          `SELECT employee_code, fullname_lo
           FROM odg_employee
           WHERE department_code = $1
             AND employee_code != $2
             AND employment_status = 'ACTIVE'
             AND NOT (position_code = ANY($3))
           ORDER BY fullname_lo ASC`,
          [employee.departmentCode, employee.employeeCode, posNotIn]
        ),
        pool.query(
          "SELECT * FROM odg_staff_eval_assignment WHERE evaluator_code = $1 AND year = $2",
          [employee.employeeCode, year]
        ),
      ]);

      const assignedCodes = assignedRes.rows.map(
        (assignment: Record<string, unknown>) => assignment.target_code as string
      );
      let assignedEmployees: { employee_code: string; fullname_lo: string }[] = [];
      if (assignedCodes.length > 0) {
        const { rows } = await pool.query(
          `SELECT employee_code, fullname_lo
           FROM odg_employee
           WHERE employee_code = ANY($1)
           ORDER BY fullname_lo ASC`,
          [assignedCodes]
        );
        assignedEmployees = rows;
      }

      targets = [
        ...teamRes.rows.map((row: Record<string, unknown>) => ({
          employee_code: row.employee_code as string,
          fullname_lo: row.fullname_lo as string,
          source: "team",
        })),
        ...assignedEmployees.map((row) => ({ ...row, source: "assigned" })),
      ];
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const availableMonths: { year: string; month: number }[] = [];
    for (let current = 1; current <= currentMonth; current += 1) {
      availableMonths.push({ year: String(currentYear), month: current });
    }
    if (currentMonth === 0) {
      availableMonths.push({ year: String(currentYear - 1), month: 12 });
    }

    return NextResponse.json({
      employeeCode: employee.employeeCode,
      employeeName: `${employee.titleLo ? `${employee.titleLo} ` : ""}${employee.fullnameLo}`.trim(),
      criteria: criteriaRes.rows,
      selfEval: selfEvalRes.rows[0] || null,
      myEvals: evalsWithNames,
      targets,
      isManager,
      currentMonth: month,
      currentYear: year,
      availableMonths,
      completedSelfMonths: completedSelfMonthsRes.rows,
    });
  } catch (err) {
    console.error("Failed to fetch staff evaluation:", err);
    return jsonError("Failed to fetch data", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const employee = session?.employee;
  if (!employee) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { target_code, scores, comment } = body;
    const previousMonth = getPreviousMonth();
    const year = body.year || previousMonth.year;
    const month = body.month || previousMonth.month;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthZeroIndexed = now.getMonth();
    const requestedYear = Number(year);
    const requestedMonth = Number(month);
    let isValidMonth = false;

    if (
      requestedYear === currentYear &&
      requestedMonth >= 1 &&
      requestedMonth <= currentMonthZeroIndexed
    ) {
      isValidMonth = true;
    } else if (
      currentMonthZeroIndexed === 0 &&
      requestedYear === currentYear - 1 &&
      requestedMonth === 12
    ) {
      isValidMonth = true;
    }

    if (!isValidMonth) {
      return jsonError("ບໍ່ສາມາດປະເມີນເດືອນນີ້ໄດ້", 400);
    }

    if (!target_code || !scores || typeof scores !== "object") {
      return jsonError("ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ", 400);
    }

    let evalType = "self";
    if (target_code !== employee.employeeCode) {
      const isManager = ["11", "12"].includes(employee.positionCode);
      if (!isManager) {
        return jsonError("ທ່ານບໍ່ມີສິດປະເມີນຜູ້ອື່ນ", 403);
      }

      const posNotIn = employee.positionCode === "11" ? ["11"] : ["11", "12"];
      const { rows: teamCheck } = await pool.query(
        `SELECT employee_code
         FROM odg_employee
         WHERE employee_code = $1
           AND department_code = $2
           AND employment_status = 'ACTIVE'
           AND NOT (position_code = ANY($3))
         LIMIT 1`,
        [target_code, employee.departmentCode, posNotIn]
      );

      if (teamCheck.length > 0) {
        evalType = "manager";
      } else {
        const { rows: assignCheck } = await pool.query(
          `SELECT id
           FROM odg_staff_eval_assignment
           WHERE evaluator_code = $1 AND target_code = $2 AND year = $3
           LIMIT 1`,
          [employee.employeeCode, target_code, year]
        );
        if (assignCheck.length > 0) {
          evalType = "cross";
        } else {
          return jsonError("ທ່ານບໍ່ໄດ້ຮັບ assign ໃຫ້ປະເມີນຄົນນີ້", 403);
        }
      }
    }

    const { rows: existingRows } = await pool.query(
      `SELECT id
       FROM odg_staff_evaluation
       WHERE evaluator_code = $1 AND target_code = $2 AND year = $3 AND month = $4
       LIMIT 1`,
      [employee.employeeCode, target_code, year, month]
    );
    if (existingRows.length > 0) {
      return jsonError("ທ່ານໄດ້ປະເມີນຄົນນີ້ເດືອນນີ້ແລ້ວ", 409);
    }

    const { rows } = await pool.query(
      `INSERT INTO odg_staff_evaluation (evaluator_code, target_code, eval_type, year, month, scores, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [employee.employeeCode, target_code, evalType, year, month, JSON.stringify(scores), comment || null]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("Failed to save staff evaluation:", err);
    return jsonError("ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້", 500);
  }
}
