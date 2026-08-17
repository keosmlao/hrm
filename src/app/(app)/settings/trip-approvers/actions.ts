"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type ApproverFormState = { error?: string; success?: string };

const TYPES = new Set(["UNIT_HEAD", "DEPT_HEAD", "DIVISION_HEAD", "SPECIFIC"]);

export async function addApprovalStep(_prev: ApproverFormState, fd: FormData): Promise<ApproverFormState> {
  await requireRole("ADMIN", "HR");
  const approverType = String(fd.get("approverType") ?? "");
  const specific = String(fd.get("specificEmployeeCode") ?? "").trim();
  if (!TYPES.has(approverType)) return { error: "ເລືອກປະເພດຜູ້ອະນຸມັດ" };
  if (approverType === "SPECIFIC" && !specific) return { error: "ເລືອກຄົນສະເພາະ" };
  const max = await prisma.tripApprovalStep.aggregate({ _max: { stepOrder: true } });
  await prisma.tripApprovalStep.create({
    data: { stepOrder: (max._max.stepOrder ?? -1) + 1, approverType, specificEmployeeCode: approverType === "SPECIFIC" ? specific : null },
  });
  revalidatePath("/settings/trip-approvers");
  return { success: "ເພີ່ມຂັ້ນອະນຸມັດແລ້ວ" };
}

export async function removeApprovalStep(id: string) {
  await requireRole("ADMIN", "HR");
  await prisma.tripApprovalStep.delete({ where: { id } }).catch(() => {});
  revalidatePath("/settings/trip-approvers");
}

export async function moveApprovalStep(id: string, dir: "up" | "down") {
  await requireRole("ADMIN", "HR");
  const steps = await prisma.tripApprovalStep.findMany({ orderBy: { stepOrder: "asc" } });
  const idx = steps.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= steps.length) return;
  const a = steps[idx], b = steps[swapIdx];
  const tmp = Math.max(...steps.map((s) => s.stepOrder)) + 1000;
  await prisma.$transaction([
    prisma.tripApprovalStep.update({ where: { id: a.id }, data: { stepOrder: tmp } }),
    prisma.tripApprovalStep.update({ where: { id: b.id }, data: { stepOrder: a.stepOrder } }),
    prisma.tripApprovalStep.update({ where: { id: a.id }, data: { stepOrder: b.stepOrder } }),
  ]);
  revalidatePath("/settings/trip-approvers");
}
