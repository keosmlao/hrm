"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type VehicleApproverState = { error?: string; success?: string };

export async function addVehicleApprover(_prev: VehicleApproverState, fd: FormData): Promise<VehicleApproverState> {
  await requireRole("ADMIN", "HR");
  const code = String(fd.get("employeeCode") ?? "").trim();
  if (!code) return { error: "ເລືອກພະນັກງານ" };
  const emp = await prisma.employee.findUnique({ where: { code }, select: { code: true } });
  if (!emp) return { error: "ບໍ່ພົບພະນັກງານ" };
  await prisma.vehicleApprover.upsert({ where: { employeeCode: code }, create: { employeeCode: code }, update: {} });
  revalidatePath("/settings/vehicle-approvers");
  return { success: "ເພີ່ມຜູ້ອະນຸມັດລົດແລ້ວ" };
}

export async function removeVehicleApprover(code: string) {
  await requireRole("ADMIN", "HR");
  await prisma.vehicleApprover.delete({ where: { employeeCode: code } }).catch(() => {});
  revalidatePath("/settings/vehicle-approvers");
}
