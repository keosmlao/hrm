import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeId: number;
    employeeCode: string;
    fullnameLo: string;
    fullnameEn: string;
    titleLo: string;
    titleEn: string;
    nickname: string;
    positionCode: string;
    divisionCode: string;
    departmentCode: string;
    unitCode: string;
    hireDate: string;
    employmentStatus: string;
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

export async function GET() {
  const session = await getSession();
  if (!session?.employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const surveys = await prisma.odg_training_survey.findMany({
      where: { employee_code: session.employee.employeeCode },
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(surveys);
  } catch (err) {
    console.error("Failed to fetch training needs:", err);
    return NextResponse.json(
      { error: "Failed to fetch training needs" },
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

    const { skill_priorities, fiscal_year } = body;
    if (!skill_priorities || !fiscal_year) {
      return NextResponse.json(
        { error: "ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ" },
        { status: 400 }
      );
    }

    // Check if already submitted
    const existing = await prisma.odg_training_survey.findFirst({
      where: { employee_code: session.employee.employeeCode },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "ທ່ານໄດ້ສົ່ງແບບສຳຫຼວດແລ້ວ ບໍ່ສາມາດສົ່ງຊ້ຳໄດ້" },
        { status: 409 }
      );
    }

    const allowedSupervisorYears = ["<1", "1-3", ">3"];
    const supervisorYears = allowedSupervisorYears.includes(body.supervisor_years)
      ? body.supervisor_years
      : null;

    const created = await prisma.odg_training_survey.create({
      data: {
        employee_code: session.employee.employeeCode,
        department_name: body.department_name || null,
        team_count: body.team_count || null,
        supervisor_years: supervisorYears,
        skill_priorities,
        team_problems: body.team_problems || null,
        suggested_course: body.suggested_course || null,
        fiscal_year: body.fiscal_year,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Failed to create training need:", err);
    return NextResponse.json(
      { error: "ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້" },
      { status: 500 }
    );
  }
}
