"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/auth";
import type { SessionPayload } from "@/lib/session";
import { overtimeRateForEmployee } from "@/lib/overtime-settings";

export type OvertimeFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const requestSchema = z.object({
  workDate: z.string().min(1, "ເລືອກວັນທີ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "ເວລາບໍ່ຖືກຕ້ອງ"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "ເວລາບໍ່ຖືກຕ້ອງ"),
  reason: z.string().max(500).optional(),
});

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

async function log(
  id: string,
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED",
  session: SessionPayload,
  comment?: string,
) {
  await prisma.approvalLog.create({
    data: {
      entityType: "OvertimeRequest",
      entityId: id,
      action,
      actorUserId: session.userId,
      actorRole: session.role,
      comment: comment ?? null,
    },
  });
}

async function canApprove(session: SessionPayload, employeeCode: string) {
  if (hasRole(session, "ADMIN", "HR")) return true;
  if (session.role !== "MANAGER") return false;
  const profile = await prisma.employeeProfile.findUnique({
    where: { employeeCode },
    select: { managerCode: true },
  });
  return profile?.managerCode === session.employeeCode;
}

export async function createOvertime(
  _previous: OvertimeFormState,
  formData: FormData,
): Promise<OvertimeFormState> {
  const session = await requireUser();
  if (!session.employeeCode) {
    return { error: "ບັນຊີນີ້ບໍ່ໄດ້ຜູກກັບພະນັກງານ" };
  }

  const parsed = requestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "ກະລຸນາກວດຂໍ້ມູນ", fieldErrors };
  }

  const value = parsed.data;
  const workDate = new Date(`${value.workDate}T00:00:00Z`);
  const minutes = timeMinutes(value.endTime) - timeMinutes(value.startTime);
  if (minutes <= 0) {
    return { error: "ເວລາສິ້ນສຸດຕ້ອງຫຼັງເວລາເລີ່ມ" };
  }
  if (minutes > 12 * 60) {
    return { error: "ຄຳຂໍ OT ຕ້ອງບໍ່ເກີນ 12 ຊົ່ວໂມງ" };
  }

  const overtimeRate = await overtimeRateForEmployee(session.employeeCode, workDate);
  const request = await prisma.overtimeRequest.create({
    data: {
      employeeCode: session.employeeCode,
      workDate,
      startTime: value.startTime,
      endTime: value.endTime,
      hours: Math.round((minutes / 60) * 100) / 100,
      rate: overtimeRate.rate,
      rateType: overtimeRate.rateType,
      reason: value.reason?.trim() || null,
      status: "PENDING_MANAGER",
    },
  });
  await log(request.id, "SUBMITTED", session, `OT ${request.hours} ຊົ່ວໂມງ`);
  revalidatePath("/overtime");
  redirect("/overtime");
}

export async function approveOvertime(id: string) {
  const session = await requireUser();
  const request = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!request || !(await canApprove(session, request.employeeCode))) return;

  if (request.status === "PENDING_MANAGER") {
    const status = hasRole(session, "ADMIN", "HR") ? "APPROVED" : "PENDING_HR";
    await prisma.overtimeRequest.update({ where: { id }, data: { status } });
    await log(id, "APPROVED", session, status === "APPROVED" ? "HR ອະນຸມັດ" : "ຫົວໜ້າອະນຸມັດ");
  } else if (request.status === "PENDING_HR" && hasRole(session, "ADMIN", "HR")) {
    await prisma.overtimeRequest.update({ where: { id }, data: { status: "APPROVED" } });
    await log(id, "APPROVED", session, "HR ອະນຸມັດ");
  }
  revalidatePath("/overtime");
}

export async function rejectOvertime(id: string, formData: FormData) {
  const session = await requireUser();
  const request = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!request || !(await canApprove(session, request.employeeCode))) return;
  if (!['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) return;

  const reason = String(formData.get("reason") ?? "").trim();
  await prisma.overtimeRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: reason || null },
  });
  await log(id, "REJECTED", session, reason || undefined);
  revalidatePath("/overtime");
}

export async function cancelOvertime(id: string) {
  const session = await requireUser();
  const request = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!request || request.employeeCode !== session.employeeCode) return;
  if (!['DRAFT', 'PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) return;
  await prisma.overtimeRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await log(id, "CANCELLED", session, "ຜູ້ຂໍຍົກເລີກ");
  revalidatePath("/overtime");
}
