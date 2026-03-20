import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";
import type { SessionData } from "@/lib/types";

function requireManager(session: SessionData) {
  return !!session.employee && ["11", "12"].includes(session.employee.positionCode);
}

export async function GET() {
  const session = await getSession();
  if (!session?.employee) {
    return jsonError("Unauthorized", 401);
  }
  if (!requireManager(session)) {
    return jsonError("ສະເພາະຫົວໜ້າ/ຜູ້ຈັດການ", 403);
  }

  const employee = session.employee;
  const year = String(new Date().getFullYear());

  try {
    const posNotIn = employee.positionCode === "11" ? ["11"] : ["11", "12"];
    const { rows: assignmentRows } = await pool.query(
      "SELECT * FROM odg_staff_eval_assignment WHERE evaluator_code = $1 AND year = $2 ORDER BY id ASC",
      [employee.employeeCode, year]
    );
    const assignedCodes = assignmentRows.map((assignment: { target_code: string }) => assignment.target_code);

    let assignedEmployees: Record<string, unknown>[] = [];
    if (assignedCodes.length > 0) {
      const { rows } = await pool.query(
        `SELECT e.*, p.position_name_lo, d.department_name_lo
         FROM odg_employee e
         LEFT JOIN odg_position p ON e.position_code = p.position_code
         LEFT JOIN odg_department d ON e.department_code = d.department_code
         WHERE e.employee_code = ANY($1)`,
        [assignedCodes]
      );
      assignedEmployees = rows;
    }

    const { rows: candidateRows } = await pool.query(
      `SELECT e.employee_code, e.fullname_lo, e.position_code, p.position_name_lo, e.department_code, d.department_name_lo
       FROM odg_employee e
       LEFT JOIN odg_position p ON e.position_code = p.position_code
       LEFT JOIN odg_department d ON e.department_code = d.department_code
       WHERE e.employee_code != $1
         AND NOT (e.employee_code = ANY($2))
         AND e.employment_status = 'ACTIVE'
         AND NOT (e.position_code = ANY($3))
       ORDER BY e.position_code ASC, e.fullname_lo ASC`,
      [employee.employeeCode, assignedCodes.length > 0 ? assignedCodes : ["__none__"], posNotIn]
    );

    const employeeMap = new Map(
      assignedEmployees.map((assignedEmployee) => [assignedEmployee.employee_code, assignedEmployee])
    );

    const assigned = assignmentRows.map((assignment: Record<string, unknown>) => {
      const assignedEmployee = employeeMap.get(assignment.target_code as string) as
        | Record<string, unknown>
        | undefined;

      return {
        id: assignment.id,
        target_code: assignment.target_code,
        fullname_lo: assignedEmployee?.fullname_lo ?? null,
        position_code: assignedEmployee?.position_code ?? null,
        position_name_lo: assignedEmployee?.position_name_lo ?? null,
        department_code: assignedEmployee?.department_code ?? null,
        department_name_lo: assignedEmployee?.department_name_lo ?? null,
      };
    });

    return NextResponse.json({ assigned, candidates: candidateRows });
  } catch (err) {
    console.error("Failed to fetch assignments:", err);
    return jsonError("ເກີດຂໍ້ຜິດພາດ", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.employee) {
    return jsonError("Unauthorized", 401);
  }
  if (!requireManager(session)) {
    return jsonError("ສະເພາະຫົວໜ້າ/ຜູ້ຈັດການ", 403);
  }

  try {
    const { target_code } = await request.json();
    if (!target_code) {
      return jsonError("ກະລຸນາເລືອກຜູ້ຖືກປະເມີນ", 400);
    }

    const year = String(new Date().getFullYear());

    try {
      const { rows } = await pool.query(
        `INSERT INTO odg_staff_eval_assignment (evaluator_code, target_code, year)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [session.employee.employeeCode, target_code, year]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        return jsonError("ມີໃນລາຍການແລ້ວ", 409);
      }
      throw err;
    }
  } catch (err) {
    console.error("Failed to add assignment:", err);
    return jsonError("ເກີດຂໍ້ຜິດພາດ", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session?.employee) {
    return jsonError("Unauthorized", 401);
  }
  if (!requireManager(session)) {
    return jsonError("ສະເພາະຫົວໜ້າ/ຜູ້ຈັດການ", 403);
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return jsonError("ບໍ່ພົບ ID", 400);
    }

    await pool.query(
      "DELETE FROM odg_staff_eval_assignment WHERE id = $1 AND evaluator_code = $2",
      [Number(id), session.employee.employeeCode]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete assignment:", err);
    return jsonError("ເກີດຂໍ້ຜິດພາດ", 500);
  }
}
