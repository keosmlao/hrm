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

/** GET — ລາຍຊື່ assignment ທີ່ມີ + ລາຍຊື່ຄົນທີ່ເລືອກໄດ້ */
export async function GET() {
  const session = await getSession();
  if (!session?.employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emp = session.employee;
  const isManager = ["11", "12"].includes(emp.positionCode);
  if (!isManager) {
    return NextResponse.json({ error: "ສະເພາະຫົວໜ້າ/ຜູ້ຈັດການ" }, { status: 403 });
  }

  const year = String(new Date().getFullYear());

  try {
    const posNotIn = emp.positionCode === "11" ? ["11"] : ["11", "12"];

    const assignmentRows = await prisma.odg_staff_eval_assignment.findMany({
      where: { evaluator_code: emp.employeeCode, year },
      orderBy: { id: "asc" },
    });

    const assignedCodes = assignmentRows.map((a) => a.target_code);

    const [assignedEmps, candidateRows] = await Promise.all([
      assignedCodes.length > 0
        ? prisma.odg_employee.findMany({
            where: { employee_code: { in: assignedCodes } },
            include: { odg_position_rel: true, odg_department_rel: true },
          })
        : Promise.resolve([]),
      prisma.odg_employee.findMany({
        where: {
          employee_code: { not: emp.employeeCode, notIn: assignedCodes },
          employment_status: "ACTIVE",
          position_code: { notIn: posNotIn },
        },
        include: { odg_position_rel: true, odg_department_rel: true },
        orderBy: [{ position_code: "asc" }, { fullname_lo: "asc" }],
      }),
    ]);
    const empMap = new Map(assignedEmps.map((e) => [e.employee_code, e]));

    const assigned = assignmentRows.map((a) => {
      const e = empMap.get(a.target_code);
      return {
        id: a.id,
        target_code: a.target_code,
        fullname_lo: e?.fullname_lo ?? null,
        position_code: e?.position_code ?? null,
        position_name_lo: e?.odg_position_rel?.position_name_lo ?? null,
        department_code: e?.department_code ?? null,
        department_name_lo: e?.odg_department_rel?.department_name_lo ?? null,
      };
    });

    const candidates = candidateRows.map((e) => ({
      employee_code: e.employee_code,
      fullname_lo: e.fullname_lo,
      position_code: e.position_code,
      position_name_lo: e.odg_position_rel?.position_name_lo ?? null,
      department_code: e.department_code,
      department_name_lo: e.odg_department_rel?.department_name_lo ?? null,
    }));

    return NextResponse.json({ assigned, candidates });
  } catch (err) {
    console.error("Failed to fetch assignments:", err);
    return NextResponse.json({ error: "ເກີດຂໍ້ຜິດພາດ" }, { status: 500 });
  }
}

/** POST — ເພີ່ມ assignment */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emp = session.employee;
  const isManager = ["11", "12"].includes(emp.positionCode);
  if (!isManager) {
    return NextResponse.json({ error: "ສະເພາະຫົວໜ້າ/ຜູ້ຈັດການ" }, { status: 403 });
  }

  try {
    const { target_code } = await request.json();
    if (!target_code) {
      return NextResponse.json({ error: "ກະລຸນາເລືອກຜູ້ຖືກປະເມີນ" }, { status: 400 });
    }

    const year = String(new Date().getFullYear());

    try {
      const created = await prisma.odg_staff_eval_assignment.create({
        data: { evaluator_code: emp.employeeCode, target_code, year },
      });
      return NextResponse.json(created, { status: 201 });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "ມີໃນລາຍການແລ້ວ" }, { status: 409 });
      }
      throw e;
    }
  } catch (err) {
    console.error("Failed to add assignment:", err);
    return NextResponse.json({ error: "ເກີດຂໍ້ຜິດພາດ" }, { status: 500 });
  }
}

/** DELETE — ລົບ assignment */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session?.employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emp = session.employee;
  const isManager = ["11", "12"].includes(emp.positionCode);
  if (!isManager) {
    return NextResponse.json({ error: "ສະເພາະຫົວໜ້າ/ຜູ້ຈັດການ" }, { status: 403 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ບໍ່ພົບ ID" }, { status: 400 });
    }

    await prisma.odg_staff_eval_assignment.deleteMany({
      where: { id: Number(id), evaluator_code: emp.employeeCode },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete assignment:", err);
    return NextResponse.json({ error: "ເກີດຂໍ້ຜິດພາດ" }, { status: 500 });
  }
}
