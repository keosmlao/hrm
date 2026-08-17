import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSession, type Role, type SessionPayload } from "./session";

/** ບັງຄັບໃຫ້ login ກ່ອນ */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  // ອ່ານ role ສົດຈາກ DB ທຸກຄັ້ງ — ຖ້າ admin ປ່ຽນສິດ ຈະມີຜົນທັນທີ ໂດຍບໍ່ຕ້ອງ login ໃໝ່
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/login");

  return { ...session, role: user.role };
}

/** ບັງຄັບສິດທິ — ບໍ່ມີສິດ ຈະສົ່ງກັບໜ້າຫຼັກ */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireUser();
  if (!roles.includes(session.role)) redirect("/dashboard?error=no_permission");
  return session;
}

export function hasRole(session: SessionPayload, ...roles: Role[]) {
  return roles.includes(session.role);
}

/** ADMIN/HR/EXECUTIVE ເບິ່ງໄດ້ທຸກຄົນ */
export function canViewAllEmployees(session: SessionPayload) {
  return hasRole(session, "ADMIN", "HR", "EXECUTIVE");
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "ຜູ້ດູແລລະບົບ",
  HR: "ຝ່າຍບຸກຄົນ",
  MANAGER: "ຫົວໜ້າພະແນກ",
  EMPLOYEE: "ພະນັກງານ",
  EXECUTIVE: "ຜູ້ບໍລິຫານ",
};
