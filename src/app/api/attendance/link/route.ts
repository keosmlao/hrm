import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyLineIdToken } from "@/lib/line";
import { verifyLegacyPassword } from "@/lib/legacy-password";
import { isEmployed } from "@/lib/employee-status";

type Body = { idToken?: string; username?: string; password?: string };

/**
 * ຜູກ LINE userId ກັບພະນັກງານ — ຄັ້ງທຳອິດທີ່ເປີດ mini app.
 * ກວດຕົວຕົນຄືກັບໜ້າ login (hrm_user ດ້ວຍ bcrypt ຫຼື odg_employee ດ້ວຍລະຫັດເກົ່າ),
 * ແລ້ວບັນທຶກ odg_employee.line_id = sub
 */
export async function POST(request: NextRequest) {
  const { idToken, username, password } = (await request
    .json()
    .catch(() => ({}))) as Body;

  const identity = idToken ? await verifyLineIdToken(idToken) : null;
  if (!identity) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (!username || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const code = username.trim();
  let employeeCode: string | null = null;

  // 1) ບັນຊີ HRM
  const user = await prisma.user.findUnique({ where: { username: code } });
  if (user) {
    const ok = user.isActive && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    employeeCode = user.employeeCode;
  } else {
    // 2) ພະນັກງານເດີມ (ລະຫັດພະນັກງານ + ລະຫັດຜ່ານເກົ່າ)
    const employee = await prisma.employee.findUnique({ where: { code } });
    if (
      !employee?.password ||
      !verifyLegacyPassword(password, employee.password) ||
      employee.employmentStatus !== "ACTIVE"
    ) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    employeeCode = employee.code;
  }

  if (!employeeCode) {
    return NextResponse.json({ error: "no_employee_link" }, { status: 409 });
  }

  const target = await prisma.employee.findUnique({
    where: { code: employeeCode },
    select: { employmentStatus: true, lineId: true },
  });
  if (!target || !isEmployed(target.employmentStatus)) {
    return NextResponse.json({ error: "inactive_employee" }, { status: 403 });
  }
  if (target.lineId && target.lineId !== identity.sub) {
    return NextResponse.json({ error: "employee_already_linked" }, { status: 409 });
  }
  const lineOwner = await prisma.employee.findFirst({
    where: { lineId: identity.sub, code: { not: employeeCode } },
    select: { code: true },
  });
  if (lineOwner) {
    return NextResponse.json({ error: "line_already_linked" }, { status: 409 });
  }

  try {
    await prisma.employee.update({
      where: { code: employeeCode },
      data: { lineId: identity.sub },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "line_already_linked" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
