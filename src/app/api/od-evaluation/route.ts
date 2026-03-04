import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeCode: string;
    positionCode: string;
    departmentCode: string;
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
    const canViewSummary =
      session.employee.positionCode === "11" &&
      ["701", "801"].includes(session.employee.departmentCode);
    const [mine, summaryRows] = await Promise.all([
      prisma.odg_od_evaluation.findUnique({
        where: { employee_code: session.employee.employeeCode },
      }),
      canViewSummary
        ? prisma.$queryRaw`SELECT
               COUNT(*)::int as total,
               COUNT(*) FILTER (WHERE q1)::int as q1_good,
               COUNT(*) FILTER (WHERE q2)::int as q2_good,
               COUNT(*) FILTER (WHERE q3)::int as q3_good,
               COUNT(*) FILTER (WHERE q4)::int as q4_good,
               COUNT(*) FILTER (WHERE q5)::int as q5_good,
               COUNT(*) FILTER (WHERE q6)::int as q6_good
             FROM odg_od_evaluation`
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      submitted: mine || null,
      summary: Array.isArray(summaryRows) ? summaryRows[0] : null,
    });
  } catch (err) {
    console.error("Failed to fetch OD evaluation:", err);
    return NextResponse.json(
      { error: "Failed to fetch evaluation" },
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
    const { q1, q2, q3, q4, q5, q6, comment } = body;

    if (
      typeof q1 !== "boolean" ||
      typeof q2 !== "boolean" ||
      typeof q3 !== "boolean" ||
      typeof q4 !== "boolean" ||
      typeof q5 !== "boolean" ||
      typeof q6 !== "boolean"
    ) {
      return NextResponse.json(
        { error: "ກະລຸນາຕອບທຸກຄຳຖາມ" },
        { status: 400 }
      );
    }

    const existing = await prisma.odg_od_evaluation.findUnique({
      where: { employee_code: session.employee.employeeCode },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "ທ່ານໄດ້ປະເມີນແລ້ວ ບໍ່ສາມາດສົ່ງຊ້ຳໄດ້" },
        { status: 409 }
      );
    }

    const result = await prisma.odg_od_evaluation.create({
      data: {
        employee_code: session.employee.employeeCode,
        q1,
        q2,
        q3,
        q4,
        q5,
        q6,
        comment: comment || null,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Failed to save OD evaluation:", err);
    return NextResponse.json(
      { error: "ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້" },
      { status: 500 }
    );
  }
}
