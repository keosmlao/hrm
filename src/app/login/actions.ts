"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { verifyLegacyPassword } from "@/lib/legacy-password";
import type { Role } from "@/lib/jwt";

export type LoginState = { error?: string };

const DUMMY_HASH = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ" };
  }

  // ໜ້າ login ພະນັກງານສົ່ງ redirectTo=/employee ມາ → ໄປ portal ພະນັກງານ (ບໍ່ວ່າ role ໃດ)
  const requested = String(formData.get("redirectTo") ?? "").trim();
  const forcedDest = /^\/[^/\\]/.test(requested) ? requested : null;

  // ── 1. ບັນຊີ HRM (hrm_user) ──
  const user = await prisma.user.findUnique({
    where: { username },
    include: { employee: true },
  });

  if (user) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok || !user.isActive) {
      return { error: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createSession({
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeCode: user.employeeCode,
      name: user.employee?.fullnameLo ?? user.username,
    });
    redirect(forcedDest ?? (user.role === "EMPLOYEE" ? "/employee" : "/dashboard"));
  }

  // ── 2. ບັນຊີພະນັກງານເດີມ (odg_employee: ລະຫັດພະນັກງານ + ລະຫັດຜ່ານເກົ່າ) ──
  const employee = await prisma.employee.findUnique({
    where: { code: username },
  });

  // ໃຫ້ໃຊ້ເວລາໃກ້ຄຽງກັນສະເໝີ ເພື່ອບໍ່ໃຫ້ຮູ້ວ່າບັນຊີມີຢູ່ຫຼືບໍ່
  if (!employee?.password) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { error: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
  }

  if (!verifyLegacyPassword(password, employee.password)) {
    return { error: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
  }

  if (employee.employmentStatus !== "ACTIVE") {
    return { error: "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ — ຕິດຕໍ່ HR" };
  }

  // ── ຍົກລະດັບບັນຊີ: ສ້າງ hrm_user ພ້ອມ bcrypt (ບໍ່ແຕະ odg_employee.password) ──
  const position = employee.positionCode
    ? await prisma.position.findUnique({ where: { code: employee.positionCode } })
    : null;
  const role: Role = position?.isManager ? "MANAGER" : "EMPLOYEE";

  const created = await prisma.user.create({
    data: {
      username: employee.code,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      employeeCode: employee.code,
      lastLoginAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: created.id,
      action: "LOGIN_MIGRATED",
      entityType: "User",
      entityId: created.id,
      detail: `ຍົກລະດັບບັນຊີເດີມຂອງ ${employee.code} ມາໃຊ້ bcrypt`,
    },
  });

  await createSession({
    userId: created.id,
    username: created.username,
    role,
    employeeCode: employee.code,
    name: employee.fullnameLo,
  });

  redirect(forcedDest ?? (role === "EMPLOYEE" ? "/employee" : "/dashboard"));
}
