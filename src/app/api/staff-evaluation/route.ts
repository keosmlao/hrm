import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

interface SessionData {
  lineUserId: string;
  employee: {
    employeeCode: string;
    positionCode: string;
    departmentCode: string;
    unitCode: string;
  } | null;
}

async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session) return null;
  try {
    return JSON.parse(Buffer.from(session.value, "base64").toString());
  } catch {
    return null;
  }
}

/** ຄຳນວນເດືອນກ່ອນໜ້າ (ເດືອນທີ່ຕ້ອງປະເມີນ) */
function getPreviousMonth(): { year: string; month: number } {
  const now = new Date();
  let m = now.getMonth(); // 0-indexed: Jan=0
  let y = now.getFullYear();
  if (m === 0) {
    // ມັງກອນ → ປະເມີນເດືອນ 12 ຂອງປີກ່ອນ
    return { year: String(y - 1), month: 12 };
  }
  return { year: String(y), month: m }; // m is already prev month (0-indexed)
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const empCode = session.employee.employeeCode;
  const prev = getPreviousMonth();
  const year = request.nextUrl.searchParams.get("year") || prev.year;
  const month = Number(request.nextUrl.searchParams.get("month")) || prev.month;

  try {
    const criteriaPromise = prisma.odg_staff_eval_criteria.findMany({
      orderBy: [{ question_order: 'asc' }, { option_id: 'asc' }],
    });
    const selfEvalPromise = prisma.odg_staff_evaluation.findFirst({
      where: { evaluator_code: empCode, target_code: empCode, year, month },
    });
    const evalsPromise = prisma.odg_staff_evaluation.findMany({
      where: { evaluator_code: empCode, target_code: { not: empCode }, year, month },
      orderBy: { created_at: 'desc' },
    });

    const [criteria, selfEval, evals] = await Promise.all([
      criteriaPromise, selfEvalPromise, evalsPromise,
    ] as const);

    // Build manager evals with target names
    const targetCodes = [...new Set(evals.map((e) => e.target_code))];
    const targetEmps = targetCodes.length > 0
      ? await prisma.odg_employee.findMany({
          where: { employee_code: { in: targetCodes } },
          select: { employee_code: true, fullname_lo: true },
        })
      : [];
    const nameMap = new Map(
      targetEmps.map((e: { employee_code: string; fullname_lo: string | null }) => [e.employee_code, e.fullname_lo])
    );
    const evalsWithNames = evals.map((e) => ({ ...e, target_name: nameMap.get(e.target_code) ?? null }));

    // Check if manager/head
    const isManager = ["11", "12"].includes(session.employee.positionCode);

    let targets: { employee_code: string; fullname_lo: string; source: string }[] = [];

    if (isManager) {
      // ລູກທີມ = ຄົນໃນພະແນກ/ໜ່ວຍງານ ທີ່ຕຳແໜ່ງຕ່ຳກ່ວາ
      // position_code 11=ຜູ້ຈັດການ, 12=ຫົວໜ້າ, ອື່ນໆ=ພະນັກງານ
      const posCode = session.employee.positionCode;
      const departmentCode = session.employee.departmentCode;
      const unitCode = session.employee.unitCode;
      const posNotIn = posCode === '11' ? ['11'] : ['11', '12'];

      const [team, assignedRows] = await Promise.all([
        prisma.odg_employee.findMany({
          where: {
            department_code: departmentCode,
            employee_code: { not: empCode },
            employment_status: 'ACTIVE',
            position_code: { notIn: posNotIn },
          },
          select: { employee_code: true, fullname_lo: true },
          orderBy: { fullname_lo: 'asc' },
        }),
        prisma.odg_staff_eval_assignment.findMany({
          where: { evaluator_code: empCode, year },
        }),
      ]);

      const assignedCodes = assignedRows.map(a => a.target_code);
      const assignedEmps = assignedCodes.length > 0
        ? await prisma.odg_employee.findMany({
            where: { employee_code: { in: assignedCodes } },
            select: { employee_code: true, fullname_lo: true },
            orderBy: { fullname_lo: 'asc' },
          })
        : [];

      targets = team.map((r) => ({
        ...r,
        source: "team",
      }));
      targets = [
        ...targets,
        ...assignedEmps.map((r) => ({
          ...r,
          source: "assigned",
        })),
      ];
    }

    // ເດືອນທີ່ປະເມີນໄດ້ (ເດືອນກ່ອນໜ້າ ພາຍໃນປີ)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed
    const availableMonths: { year: string; month: number }[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      availableMonths.push({ year: String(currentYear), month: m });
    }
    // ຖ້າເດືອນ ມ.ກ. → ເພີ່ມເດືອນ 12 ປີກ່ອນ
    if (currentMonth === 0) {
      availableMonths.push({ year: String(currentYear - 1), month: 12 });
    }

    return NextResponse.json({
      criteria,
      selfEval: selfEval || null,
      myEvals: evalsWithNames,
      targets,
      isManager,
      currentMonth: month,
      currentYear: year,
      availableMonths,
    });
  } catch (err) {
    console.error("Failed to fetch staff evaluation:", err);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { target_code, scores, comment } = body;
    const empCode = session.employee.employeeCode;

    // ໃຊ້ເດືອນຈາກ client (ສຳລັບປະເມີນເດືອນຄ້າງ) ຫຼື ເດືອນກ່ອນໜ້າ
    const prev = getPreviousMonth();
    const year = body.year || prev.year;
    const month = body.month || prev.month;

    // ກວດວ່າເດືອນທີ່ສົ່ງມາຢູ່ໃນຊ່ວງປະເມີນໄດ້
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth0 = now.getMonth(); // 0-indexed
    const requestedYear = Number(year);
    const requestedMonth = Number(month);
    let isValidMonth = false;
    if (requestedYear === curYear && requestedMonth >= 1 && requestedMonth <= curMonth0) {
      isValidMonth = true;
    } else if (curMonth0 === 0 && requestedYear === curYear - 1 && requestedMonth === 12) {
      isValidMonth = true;
    }
    if (!isValidMonth) {
      return NextResponse.json(
        { error: "ບໍ່ສາມາດປະເມີນເດືອນນີ້ໄດ້" },
        { status: 400 }
      );
    }

    if (!target_code || !scores || typeof scores !== "object") {
      return NextResponse.json(
        { error: "ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ" },
        { status: 400 }
      );
    }

    // Determine eval type
    let evalType = "self";
    const targetCode = target_code;
    const departmentCode = session.employee.departmentCode;
    const unitCode = session.employee.unitCode;

    if (targetCode !== empCode) {
      const posCode = session.employee.positionCode;
      const isManager = ["11", "12"].includes(posCode);
      if (!isManager) {
        return NextResponse.json(
          { error: "ທ່ານບໍ່ມີສິດປະເມີນຜູ້ອື່ນ" },
          { status: 403 }
        );
      }

      // ກວດວ່າ target ແມ່ນລູກທີມ (ພະແນກ/ໜ່ວຍງານດຽວກັນ, ຕຳແໜ່ງຕ່ຳກ່ວາ, ACTIVE)
      const posNotIn = posCode === "11" ? ["11"] : ["11", "12"];
      const teamCheck = await prisma.odg_employee.findFirst({
        where: {
          employee_code: targetCode,
          department_code: departmentCode,
          employment_status: "ACTIVE",
          position_code: { notIn: posNotIn },
        },
        select: { employee_code: true },
      });

      if (teamCheck) {
        evalType = "manager";
      } else {
        // ກວດວ່າ target ຖືກ assign ມາ
        const assignCheck = await prisma.odg_staff_eval_assignment.findFirst({
          where: { evaluator_code: empCode, target_code: targetCode, year },
        });
        if (assignCheck) {
          evalType = "cross";
        } else {
          return NextResponse.json(
            { error: "ທ່ານບໍ່ໄດ້ຮັບ assign ໃຫ້ປະເມີນຄົນນີ້" },
            { status: 403 }
          );
        }
      }
    }

    // Check duplicate for this month
    const existing = await prisma.odg_staff_evaluation.findFirst({
      where: { evaluator_code: empCode, target_code: targetCode, year, month },
    });
    if (existing) {
      return NextResponse.json(
        { error: "ທ່ານໄດ້ປະເມີນຄົນນີ້ເດືອນນີ້ແລ້ວ ບໍ່ສາມາດສົ່ງຊ້ຳໄດ້" },
        { status: 409 }
      );
    }

    const result = await prisma.odg_staff_evaluation.create({
      data: {
        evaluator_code: empCode,
        target_code: targetCode,
        eval_type: evalType,
        year,
        month,
        scores,
        comment: comment || null,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Failed to save staff evaluation:", err);
    return NextResponse.json(
      { error: "ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້" },
      { status: 500 }
    );
  }
}
