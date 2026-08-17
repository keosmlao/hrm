"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/auth";
import { lateMinutesFor, workedMinutesFor } from "@/lib/attendance";
import { getEmployeeAttendancePolicy } from "@/lib/hrm-settings";
import type { SessionPayload } from "@/lib/session";

export type CorrectionFormState = { error?: string; success?: string };

const correctionSchema = z.object({
  employeeCode: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
  reason: z.string().trim().min(3).max(500),
});

function laoInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

export async function submitAttendanceCorrection(
  _previous: CorrectionFormState,
  formData: FormData,
): Promise<CorrectionFormState> {
  const session = await requireUser();
  const parsed = correctionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດພະນັກງານ, ວັນທີ, ເວລາ ແລະເຫດຜົນ" };
  const value = parsed.data;
  const employeeCode = hasRole(session, "ADMIN", "HR")
    ? value.employeeCode
    : session.employeeCode;
  if (!employeeCode) return { error: "ບັນຊີນີ້ບໍ່ໄດ້ຜູກກັບພະນັກງານ" };
  if (!value.checkInTime && !value.checkOutTime) return { error: "ຕ້ອງໃສ່ເວລາເຂົ້າ ຫຼືເວລາອອກຢ່າງໜ້ອຍ 1 ລາຍການ" };

  const workDate = new Date(`${value.workDate}T00:00:00Z`);
  const requestedCheckInAt = value.checkInTime ? laoInstant(value.workDate, value.checkInTime) : null;
  let requestedCheckOutAt = value.checkOutTime ? laoInstant(value.workDate, value.checkOutTime) : null;
  if (requestedCheckInAt && requestedCheckOutAt && requestedCheckOutAt <= requestedCheckInAt) {
    requestedCheckOutAt = new Date(requestedCheckOutAt.getTime() + 24 * 60 * 60000);
  }
  const pending = await prisma.attendanceCorrectionRequest.findFirst({
    where: { employeeCode, workDate, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return { error: "ວັນທີນີ້ມີຄຳຂແກ້ໄຂທີ່ລໍຖ້າກວດຢູ່ແລ້ວ" };

  const request = await prisma.attendanceCorrectionRequest.create({
    data: {
      employeeCode,
      workDate,
      requestedCheckInAt,
      requestedCheckOutAt,
      reason: value.reason,
      requesterUserId: session.userId,
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "REQUEST_CORRECTION", entityType: "AttendanceCorrection", entityId: request.id, detail: value.reason },
  });
  revalidatePath("/attendance/corrections");
  return { success: "ສົ່ງຄຳຂແກ້ໄຂເວລາແລ້ວ" };
}

async function canReview(session: SessionPayload, employeeCode: string): Promise<boolean> {
  if (hasRole(session, "ADMIN", "HR")) return true;
  if (session.role !== "MANAGER") return false;
  const profile = await prisma.employeeProfile.findUnique({
    where: { employeeCode },
    select: { managerCode: true },
  });
  return profile?.managerCode === session.employeeCode;
}

export async function approveAttendanceCorrection(id: string) {
  const session = await requireUser();
  const request = await prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING" || !(await canReview(session, request.employeeCode))) return;

  const existing = await prisma.attendance.findUnique({
    where: { employeeCode_workDate: { employeeCode: request.employeeCode, workDate: request.workDate } },
  });
  const checkInAt = request.requestedCheckInAt ?? existing?.checkInAt ?? null;
  const checkOutAt = request.requestedCheckOutAt ?? existing?.checkOutAt ?? null;
  if (!checkInAt && checkOutAt) return;
  const policy = await getEmployeeAttendancePolicy(request.employeeCode, request.workDate);
  const lateMinutes = checkInAt
    ? lateMinutesFor(checkInAt, policy.workStart, policy.lateGraceMinutes, policy.workEnd)
    : 0;
  const workedMinutes = checkInAt && checkOutAt ? workedMinutesFor(checkInAt, checkOutAt) : null;

  await prisma.$transaction([
    prisma.attendance.upsert({
      where: { employeeCode_workDate: { employeeCode: request.employeeCode, workDate: request.workDate } },
      create: {
        employeeCode: request.employeeCode,
        workDate: request.workDate,
        checkInAt,
        checkOutAt,
        lateMinutes,
        workedMinutes,
        source: "CORRECTION",
        note: request.reason,
      },
      update: { checkInAt, checkOutAt, lateMinutes, workedMinutes, source: "CORRECTION", note: request.reason },
    }),
    prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedByUserId: session.userId, reviewedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { userId: session.userId, action: "APPROVE_CORRECTION", entityType: "AttendanceCorrection", entityId: id, detail: request.reason },
    }),
  ]);
  revalidatePath("/attendance");
  revalidatePath("/attendance/corrections");
}

export async function rejectAttendanceCorrection(id: string, formData: FormData) {
  const session = await requireUser();
  const request = await prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING" || !(await canReview(session, request.employeeCode))) return;
  const reviewNote = String(formData.get("reviewNote") ?? "").trim().slice(0, 500) || null;
  await prisma.$transaction([
    prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedByUserId: session.userId, reviewedAt: new Date(), reviewNote },
    }),
    prisma.auditLog.create({
      data: { userId: session.userId, action: "REJECT_CORRECTION", entityType: "AttendanceCorrection", entityId: id, detail: reviewNote },
    }),
  ]);
  revalidatePath("/attendance/corrections");
}

export async function cancelAttendanceCorrection(id: string) {
  const session = await requireUser();
  const request = await prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING" || request.requesterUserId !== session.userId) return;
  await prisma.attendanceCorrectionRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CANCEL_CORRECTION", entityType: "AttendanceCorrection", entityId: id },
  });
  revalidatePath("/attendance/corrections");
}
