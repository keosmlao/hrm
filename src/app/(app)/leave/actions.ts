"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { eachScheduledWorkingDay } from "@/lib/attendance";
import {
  getEmployeeAttendancePolicy,
  getEmployeeDayOffKeys,
  getPublicHolidayKeys,
} from "@/lib/hrm-settings";
import type { SessionPayload } from "@/lib/session";

export type LeaveFormState = { error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  leaveTypeId: z.string().min(1, "ເລືອກປະເພດການລາ"),
  startDate: z.string().min(1, "ເລືອກວັນເລີ່ມ"),
  endDate: z.string().min(1, "ເລືອກວັນສິ້ນສຸດ"),
  reason: z.string().optional(),
  proofUrl: z.string().optional(),
});

export async function createLeave(
  _prev: LeaveFormState,
  fd: FormData,
): Promise<LeaveFormState> {
  const session = await requireUser();
  if (!session.employeeCode) return { error: "ບັນຊີນີ້ບໍ່ໄດ້ຜູກກັບພະນັກງານ — ຂໍລາບໍ່ໄດ້" };

  const raw = Object.fromEntries(fd.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ", fieldErrors: fe };
  }
  const v = parsed.data;
  if (v.endDate < v.startDate) return { error: "ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມ" };

  const startDate = new Date(`${v.startDate}T00:00:00Z`);
  const endDate = new Date(`${v.endDate}T00:00:00Z`);
  const [holidayKeys, employeeDaysOff, policy] = await Promise.all([
    getPublicHolidayKeys(startDate, endDate),
    getEmployeeDayOffKeys(session.employeeCode, startDate, endDate),
    getEmployeeAttendancePolicy(session.employeeCode, startDate),
  ]);
  const excludedDates = new Set([...holidayKeys, ...employeeDaysOff]);
  const days = eachScheduledWorkingDay(
    startDate,
    endDate,
    policy.scheduleType === "ROTATING",
    excludedDates,
    new Set(policy.workDays),
  ).length;
  if (days <= 0) return { error: "ຊ່ວງທີ່ເລືອກບໍ່ມີວັນທຳການ" };

  const req = await prisma.leaveRequest.create({
    data: {
      employeeCode: session.employeeCode,
      leaveTypeId: v.leaveTypeId,
      startDate,
      endDate,
      days,
      reason: v.reason || null,
      proofUrl: v.proofUrl || null,
      status: "PENDING_MANAGER",
    },
  });
  await log(req.id, "SUBMITTED", session, `ຂໍລາ ${days} ວັນ`);

  revalidatePath("/leave");
  redirect("/leave");
}

async function log(
  id: string,
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED",
  session: SessionPayload,
  comment?: string,
) {
  await prisma.approvalLog.create({
    data: {
      entityType: "LeaveRequest",
      entityId: id,
      action,
      actorUserId: session.userId,
      actorRole: session.role,
      comment: comment ?? null,
    },
  });
}

/** ກວດວ່າ session ນີ້ອະນຸມັດຄຳຂໍນີ້ໄດ້ບໍ (ຫົວໜ້າໂດຍກົງ ຫຼື HR/ADMIN) */
async function canApprove(session: SessionPayload, employeeCode: string) {
  if (hasRole(session, "ADMIN", "HR")) return true;
  if (session.role === "MANAGER") {
    const profile = await prisma.employeeProfile.findUnique({
      where: { employeeCode },
      select: { managerCode: true },
    });
    return profile?.managerCode === session.employeeCode;
  }
  return false;
}

export async function approveLeave(id: string) {
  const session = await requireUser();
  const req = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!req) return;
  if (!(await canApprove(session, req.employeeCode))) return;

  if (req.status === "PENDING_MANAGER") {
    // ຫົວໜ້າອະນຸມັດ → ສົ່ງຕໍ່ HR (ຖ້າ HR/ADMIN ອະນຸມັດເອງ → ຂ້າມໄປ APPROVED ເລີຍ)
    if (hasRole(session, "ADMIN", "HR")) {
      await finalizeApprove(req.id, req.employeeCode, req.leaveTypeId, req.days, req.startDate, session);
    } else {
      await prisma.leaveRequest.update({ where: { id }, data: { status: "PENDING_HR" } });
      await log(id, "APPROVED", session, "ຫົວໜ້າອະນຸມັດ");
    }
  } else if (req.status === "PENDING_HR" && hasRole(session, "ADMIN", "HR")) {
    await finalizeApprove(req.id, req.employeeCode, req.leaveTypeId, req.days, req.startDate, session);
  }
  revalidatePath("/leave");
}

async function finalizeApprove(
  id: string,
  employeeCode: string,
  leaveTypeId: string,
  days: number,
  startDate: Date,
  session: SessionPayload,
) {
  const year = startDate.getUTCFullYear();
  const type = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  await prisma.$transaction([
    prisma.leaveRequest.update({ where: { id }, data: { status: "APPROVED" } }),
    prisma.leaveBalance.upsert({
      where: { employeeCode_leaveTypeId_year: { employeeCode, leaveTypeId, year } },
      update: { used: { increment: days } },
      create: {
        employeeCode,
        leaveTypeId,
        year,
        entitled: type?.daysPerYear ?? 0,
        used: days,
      },
    }),
  ]);
  await log(id, "APPROVED", session, "ອະນຸມັດ ແລະ ຕັດ balance");
}

export async function rejectLeave(id: string, formData: FormData) {
  const session = await requireUser();
  const req = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!req) return;
  if (!(await canApprove(session, req.employeeCode))) return;
  if (req.status !== "PENDING_MANAGER" && req.status !== "PENDING_HR") return;

  const reason = String(formData.get("reason") ?? "").trim();
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: reason || null },
  });
  await log(id, "REJECTED", session, reason || undefined);
  revalidatePath("/leave");
}

export async function cancelLeave(id: string) {
  const session = await requireUser();
  const req = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!req || req.employeeCode !== session.employeeCode) return;
  if (!["DRAFT", "PENDING_MANAGER", "PENDING_HR"].includes(req.status)) return;

  await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await log(id, "CANCELLED", session, "ຜູ້ຂໍຍົກເລີກ");
  revalidatePath("/leave");
}
