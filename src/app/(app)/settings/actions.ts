"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDefaultShift } from "@/lib/hrm-settings";
import { laoWorkDate } from "@/lib/attendance";

export type SettingsFormState = { error?: string; success?: string };

/** ຕັ້ງ "ກະເລີ່ມຕົ້ນ" — ໃຜບໍ່ໄດ້ມອບກະສະເພາະ ໃຊ້ອັນນີ້ */
export async function setDefaultShift(shiftId: string) {
  const session = await requireRole("ADMIN", "HR");
  await prisma.systemSetting.upsert({
    where: { key: "attendance.default_shift_id" },
    update: { value: shiftId },
    create: { key: "attendance.default_shift_id", value: shiftId },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "SystemSetting",
      entityId: "attendance.default_shift_id",
      detail: `ກະເລີ່ມຕົ້ນ = ${shiftId}`,
    },
  });
  revalidatePath("/settings/shifts");
  revalidatePath("/attendance");
}

/** ມອບ "ກະເລີ່ມຕົ້ນ" ໃຫ້ພະນັກງານ active ທຸກຄົນທີ່ຍັງບໍ່ມີການມອບກະທີ່ເປີດຢູ່ */
export async function assignDefaultShiftToAll() {
  const session = await requireRole("ADMIN", "HR");
  const shift = await getDefaultShift();
  if (!shift) return;

  const [employees, openAssignments] = await Promise.all([
    prisma.employee.findMany({ where: { employmentStatus: "ACTIVE" }, select: { code: true } }),
    prisma.employeeShiftAssignment.findMany({ where: { effectiveTo: null }, select: { employeeCode: true } }),
  ]);
  const assigned = new Set(openAssignments.map((a) => a.employeeCode));
  const from = laoWorkDate(new Date());
  const toCreate = employees
    .filter((e) => !assigned.has(e.code))
    .map((e) => ({ employeeCode: e.code, shiftId: shift.id, effectiveFrom: from }));

  if (toCreate.length) {
    await prisma.employeeShiftAssignment.createMany({ data: toCreate, skipDuplicates: true });
  }
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "EmployeeShiftAssignment",
      entityId: "bulk-default",
      detail: `ມອບກະ ${shift.name} ໃຫ້ ${toCreate.length} ຄົນ`,
    },
  });
  revalidatePath("/settings/shifts");
  revalidatePath("/attendance");
}

const attendanceSchema = z.object({
  workStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  workEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  lateGraceMinutes: z.coerce.number().int().min(0).max(180),
});

export async function saveAttendancePolicy(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = attendanceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດເວລາເຂົ້າ-ອອກ ແລະ ນາທີຜ່ອນຜັນ" };
  if (parsed.data.workEnd <= parsed.data.workStart) {
    return { error: "ເວລາອອກວຽກຕ້ອງຫຼັງເວລາເຂົ້າວຽກ" };
  }

  const values = [
    ["attendance.work_start", parsed.data.workStart],
    ["attendance.work_end", parsed.data.workEnd],
    ["attendance.late_grace_minutes", String(parsed.data.lateGraceMinutes)],
  ] as const;
  await prisma.$transaction(
    values.map(([key, value]) =>
      prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "UPDATE", entityType: "SystemSetting", entityId: "attendance", detail: JSON.stringify(parsed.data) },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/attendance");
  revalidatePath("/attendance");
  return { success: "ບັນທຶກນະໂຍບາຍການລົງເວລາແລ້ວ" };
}

const attendanceCycleSchema = z.object({
  endDay: z.coerce.number().int().min(1).max(27),
});

export async function saveAttendanceCyclePolicy(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = attendanceCycleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ວັນປິດຮອບຕ້ອງເປັນວັນທີ 1–27" };

  const current = await prisma.systemSetting.findUnique({
    where: { key: "attendance.cycle_end_day" },
  });
  const savedEndDay = Number(current?.value);
  const oldEndDay = Number.isInteger(savedEndDay) && savedEndDay >= 1 && savedEndDay <= 27
    ? savedEndDay
    : 25;
  const newEndDay = parsed.data.endDay;
  if (oldEndDay === newEndDay) return { success: "ຮອບການລົງເວລາບໍ່ມີການປ່ຽນແປງ" };

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "attendance.cycle_end_day" },
      update: { value: String(newEndDay) },
      create: { key: "attendance.cycle_end_day", value: String(newEndDay) },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entityType: "AttendanceCyclePolicy",
        entityId: "attendance-cycle",
        detail: JSON.stringify({
          oldStartDay: oldEndDay + 1,
          oldEndDay,
          newStartDay: newEndDay + 1,
          newEndDay,
        }),
      },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/settings/attendance");
  revalidatePath("/attendance");
  return { success: `ປ່ຽນຮອບເປັນວັນທີ ${newEndDay + 1}–${newEndDay} ແລ້ວ` };
}

const attendanceLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(10).max(50_000),
});

export async function saveAttendanceLocationPolicy(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const required = formData.get("required") === "on";
  const parsed = attendanceLocationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດພິກັດ ແລະລັດສະໝີ (10–50,000 ແມັດ)" };

  const values = [
    ["attendance.require_location", String(required)],
    ["attendance.office_latitude", String(parsed.data.latitude)],
    ["attendance.office_longitude", String(parsed.data.longitude)],
    ["attendance.location_radius_meters", String(parsed.data.radiusMeters)],
  ] as const;
  await prisma.$transaction([
    ...values.map(([key, value]) =>
      prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entityType: "AttendanceLocationPolicy",
        entityId: "attendance-location",
        detail: JSON.stringify({ required, ...parsed.data }),
      },
    }),
  ]);
  revalidatePath("/settings/attendance");
  revalidatePath("/clock");
  return { success: required ? "ເປີດການກວດສະຖານທີ່ແລ້ວ" : "ປິດການກວດສະຖານທີ່ແລ້ວ" };
}

const overtimeRateSchema = z.object({
  workdayRate: z.coerce.number().min(1).max(10),
  dayOffRate: z.coerce.number().min(1).max(10),
  holidayRate: z.coerce.number().min(1).max(10),
});

export async function saveOvertimeRatePolicy(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = overtimeRateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ອັດຕາ OT ຕ້ອງຢູ່ລະຫວ່າງ 1–10 ເທົ່າ" };

  const currentRows = await prisma.systemSetting.findMany({
    where: { key: { in: ["overtime.workday_rate", "overtime.day_off_rate", "overtime.holiday_rate"] } },
  });
  const current = new Map(currentRows.map((row) => [row.key, row.value]));
  const oldRates = {
    workdayRate: Number(current.get("overtime.workday_rate") ?? 1.5),
    dayOffRate: Number(current.get("overtime.day_off_rate") ?? 2),
    holidayRate: Number(current.get("overtime.holiday_rate") ?? 3),
  };
  const newRates = parsed.data;
  if (
    oldRates.workdayRate === newRates.workdayRate &&
    oldRates.dayOffRate === newRates.dayOffRate &&
    oldRates.holidayRate === newRates.holidayRate
  ) return { success: "ອັດຕາ OT ບໍ່ມີການປ່ຽນແປງ" };

  const values = [
    ["overtime.workday_rate", String(newRates.workdayRate)],
    ["overtime.day_off_rate", String(newRates.dayOffRate)],
    ["overtime.holiday_rate", String(newRates.holidayRate)],
  ] as const;
  await prisma.$transaction([
    ...values.map(([key, value]) =>
      prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entityType: "OvertimeRatePolicy",
        entityId: "overtime-rates",
        detail: JSON.stringify({ oldRates, newRates }),
      },
    }),
  ]);
  revalidatePath("/settings/overtime");
  revalidatePath("/overtime");
  return { success: "ບັນທຶກອັດຕາ OT ແລ້ວ" };
}

const leaveTypeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/).max(30),
  name: z.string().trim().min(1).max(100),
  daysPerYear: z.coerce.number().int().min(0).max(366),
});

export async function createLeaveType(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = leaveTypeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ລະຫັດໃຊ້ໄດ້ສະເພາະ A-Z, 0-9, _ ແລະ ຕ້ອງມີຊື່" };
  if (await prisma.leaveType.findUnique({ where: { code: parsed.data.code } })) {
    return { error: "ລະຫັດປະເພດການລານີ້ມີແລ້ວ" };
  }
  const leaveType = await prisma.leaveType.create({
    data: {
      ...parsed.data,
      isPaid: formData.get("isPaid") === "on",
      requiresProof: formData.get("requiresProof") === "on",
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CREATE", entityType: "LeaveType", entityId: leaveType.id, detail: leaveType.code },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/leave");
  revalidatePath("/leave");
  return { success: "ເພີ່ມປະເພດການລາແລ້ວ" };
}

export async function updateLeaveType(id: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const name = String(formData.get("name") ?? "").trim();
  const daysPerYear = Number(formData.get("daysPerYear"));
  if (!name || !Number.isInteger(daysPerYear) || daysPerYear < 0 || daysPerYear > 366) return;
  await prisma.leaveType.update({
    where: { id },
    data: {
      name,
      daysPerYear,
      isPaid: formData.get("isPaid") === "on",
      requiresProof: formData.get("requiresProof") === "on",
      isActive: formData.get("isActive") === "on",
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "UPDATE", entityType: "LeaveType", entityId: id, detail: name },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/leave");
  revalidatePath("/leave");
}

const holidaySchema = z.object({
  name: z.string().trim().min(1).max(150),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createHoliday(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ຕ້ອງມີຊື່ ແລະ ວັນທີພັກ" };
  const date = new Date(`${parsed.data.date}T00:00:00Z`);
  if (await prisma.publicHoliday.findUnique({ where: { date } })) {
    return { error: "ວັນທີນີ້ຖືກກຳນົດເປັນວັນພັກແລ້ວ" };
  }
  const holiday = await prisma.publicHoliday.create({ data: { name: parsed.data.name, date } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CREATE", entityType: "PublicHoliday", entityId: holiday.id, detail: `${parsed.data.date} · ${holiday.name}` },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/holidays");
  revalidatePath("/attendance");
  return { success: "ເພີ່ມວັນພັກແລ້ວ" };
}

export async function deleteHoliday(id: string) {
  const session = await requireRole("ADMIN", "HR");
  const holiday = await prisma.publicHoliday.findUnique({ where: { id } });
  if (!holiday) return;
  await prisma.publicHoliday.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "DELETE", entityType: "PublicHoliday", entityId: id, detail: holiday.name },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/holidays");
  revalidatePath("/attendance");
}

const shiftSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/).max(30),
  name: z.string().trim().min(1).max(100),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakMinutes: z.coerce.number().int().min(0).max(480),
  lateGraceMinutes: z.coerce.number().int().min(0).max(180),
  scheduleType: z.enum(["WEEKDAYS", "ROTATING"]),
});

function selectedWorkDays(formData: FormData): string | null {
  const days = [...new Set(formData.getAll("workDay").map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  return days.length > 0 ? days.join(",") : null;
}

export async function createWorkShift(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດລະຫັດ, ຊື່, ເວລາ ແລະ ນາທີພັກ" };
  const workDays = selectedWorkDays(formData);
  if (!workDays) return { error: "ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ວັນເຮັດວຽກ" };
  if (parsed.data.startTime === parsed.data.endTime) return { error: "ເວລາເລີ່ມ ແລະ ສິ້ນສຸດຕ້ອງບໍ່ຄືກັນ" };
  if (await prisma.workShift.findUnique({ where: { code: parsed.data.code } })) {
    return { error: "ລະຫັດກະນີ້ມີແລ້ວ" };
  }
  const shift = await prisma.workShift.create({ data: { ...parsed.data, workDays } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CREATE", entityType: "WorkShift", entityId: shift.id, detail: `${shift.code} · ${shift.name}` },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/shifts");
  return { success: "ເພີ່ມກະເຮັດວຽກແລ້ວ" };
}

export async function updateWorkShift(id: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const current = await prisma.workShift.findUnique({ where: { id } });
  if (!current) return;
  const parsed = shiftSchema.safeParse({
    code: current.code,
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    breakMinutes: formData.get("breakMinutes"),
    lateGraceMinutes: formData.get("lateGraceMinutes"),
    scheduleType: formData.get("scheduleType"),
  });
  const workDays = selectedWorkDays(formData);
  if (!parsed.success || !workDays || parsed.data.startTime === parsed.data.endTime) return;
  await prisma.workShift.update({
    where: { id },
    data: { ...parsed.data, workDays, isActive: formData.get("isActive") === "on" },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "UPDATE", entityType: "WorkShift", entityId: id, detail: current.code },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/shifts");
  revalidatePath("/attendance");
}

export async function deleteWorkShift(id: string) {
  const session = await requireRole("ADMIN", "HR");
  const shift = await prisma.workShift.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, _count: { select: { assignments: true } } },
  });
  if (!shift) redirect("/settings/shifts?shiftError=" + encodeURIComponent("ບໍ່ພົບກະເຮັດວຽກນີ້"));
  if (shift._count.assignments > 0) {
    redirect(
      "/settings/shifts?shiftError=" +
        encodeURIComponent(`ລຶບ ${shift.code} ບໍ່ໄດ້ ເພາະເຄີຍມອບໃຫ້ພະນັກງານ ${shift._count.assignments} ລາຍການ; ສາມາດປິດໃຊ້ງານແທນໄດ້`),
    );
  }

  await prisma.$transaction([
    prisma.workShift.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "DELETE",
        entityType: "WorkShift",
        entityId: id,
        detail: `${shift.code} · ${shift.name}`,
      },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/settings/shifts");
  revalidatePath("/attendance");
  redirect("/settings/shifts?shiftMessage=" + encodeURIComponent(`ລຶບກະ ${shift.code} ແລ້ວ`));
}

const assignmentSchema = z.object({
  employeeCode: z.string().min(1),
  shiftId: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function assignEmployeeShift(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາເລືອກພະນັກງານ, ກະ ແລະ ວັນເລີ່ມ" };
  const value = parsed.data;
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    return { error: "ວັນສິ້ນສຸດຕ້ອງຫຼັງວັນເລີ່ມ" };
  }
  const effectiveFrom = new Date(`${value.effectiveFrom}T00:00:00Z`);
  const effectiveTo = value.effectiveTo ? new Date(`${value.effectiveTo}T00:00:00Z`) : null;
  const farFuture = effectiveTo ?? new Date("9999-12-31T00:00:00Z");
  const overlaps = await prisma.employeeShiftAssignment.findMany({
    where: {
      employeeCode: value.employeeCode,
      effectiveFrom: { lte: farFuture },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const openPrevious = overlaps.find(
    (item) => item.effectiveTo === null && item.effectiveFrom.getTime() < effectiveFrom.getTime(),
  );
  const blocking = overlaps.find((item) => item.id !== openPrevious?.id);
  if (blocking) return { error: "ຊ່ວງວັນທີນີ້ທັບກັບການມອບກະທີ່ມີຢູ່" };

  const closeDate = new Date(effectiveFrom.getTime());
  closeDate.setUTCDate(closeDate.getUTCDate() - 1);
  const operations = [];
  if (openPrevious) {
    operations.push(
      prisma.employeeShiftAssignment.update({
        where: { id: openPrevious.id },
        data: { effectiveTo: closeDate },
      }),
    );
  }
  operations.push(
    prisma.employeeShiftAssignment.create({
      data: {
        employeeCode: value.employeeCode,
        shiftId: value.shiftId,
        effectiveFrom,
        effectiveTo,
        note: value.note || null,
      },
    }),
  );
  await prisma.$transaction(operations);
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "ASSIGN", entityType: "EmployeeShift", entityId: value.employeeCode, detail: `${value.shiftId} · ${value.effectiveFrom}` },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/shifts");
  revalidatePath(`/employees/${value.employeeCode}`);
  return { success: "ມອບກະໃຫ້ພະນັກງານແລ້ວ" };
}

export async function endShiftAssignment(id: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const assignment = await prisma.employeeShiftAssignment.findUnique({ where: { id } });
  if (!assignment) return;
  const rawDate = String(formData.get("effectiveTo") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return;
  const effectiveTo = new Date(`${rawDate}T00:00:00Z`);
  if (effectiveTo < assignment.effectiveFrom) return;
  await prisma.employeeShiftAssignment.update({ where: { id }, data: { effectiveTo } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CLOSE", entityType: "EmployeeShift", entityId: id, detail: rawDate },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/shifts");
  revalidatePath(`/employees/${assignment.employeeCode}`);
}
