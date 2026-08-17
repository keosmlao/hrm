"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { OrgScope } from "@/generated/prisma/client";

/**
 * ກຳນົດ (ຫຼືລຶບ) ຫົວໜ້າຂອງໜ່ວຍໂຄງສ້າງ — ADMIN/HR ເທົ່ານັ້ນ
 * employeeCode ວ່າງ = ລຶບຫົວໜ້າ · 1 ໜ່ວຍ ມີຫົວໜ້າໄດ້ 1 ຄົນ (ແຕ່ 1 ຄົນເປັນຫົວໜ້າຫຼາຍໜ່ວຍໄດ້)
 */
export async function setOrgHead(
  scope: OrgScope,
  code: string,
  employeeCode: string,
) {
  const session = await requireRole("ADMIN", "HR");

  if (!employeeCode) {
    await prisma.orgHead.deleteMany({ where: { scope, code } });
  } else {
    await prisma.orgHead.upsert({
      where: { scope_code: { scope, code } },
      update: { employeeCode, assignedByUserId: session.userId },
      create: { scope, code, employeeCode, assignedByUserId: session.userId },
    });
  }

  revalidatePath("/org");
  revalidatePath("/employees");
}
