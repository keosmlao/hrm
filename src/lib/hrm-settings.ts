import "server-only";

import { prisma } from "./prisma";
import { dateKey, laoWorkDate, workDateForShift } from "./attendance";

export type AttendancePolicy = {
  workStart: string;
  workEnd: string;
  lateGraceMinutes: number;
};

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  workStart: process.env.WORK_START ?? "08:00",
  workEnd: process.env.WORK_END ?? "17:00",
  lateGraceMinutes: Number(process.env.LATE_GRACE_MIN ?? "15"),
};

export async function getAttendancePolicy(): Promise<AttendancePolicy> {
  const rows = await prisma.systemSetting
    .findMany({
      where: {
        key: {
          in: [
            "attendance.work_start",
            "attendance.work_end",
            "attendance.late_grace_minutes",
          ],
        },
      },
    })
    .catch(() => []);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const grace = Number(values.get("attendance.late_grace_minutes"));
  return {
    workStart: values.get("attendance.work_start") ?? DEFAULT_ATTENDANCE_POLICY.workStart,
    workEnd: values.get("attendance.work_end") ?? DEFAULT_ATTENDANCE_POLICY.workEnd,
    lateGraceMinutes: Number.isFinite(grace) ? grace : DEFAULT_ATTENDANCE_POLICY.lateGraceMinutes,
  };
}

export type AttendanceCyclePolicy = {
  startDay: number;
  endDay: number;
};

export async function getAttendanceCyclePolicy(): Promise<AttendanceCyclePolicy> {
  const setting = await prisma.systemSetting
    .findUnique({ where: { key: "attendance.cycle_end_day" } })
    .catch(() => null);
  const savedEndDay = Number(setting?.value);
  const endDay = Number.isInteger(savedEndDay) && savedEndDay >= 1 && savedEndDay <= 27
    ? savedEndDay
    : 25;
  return { startDay: endDay + 1, endDay };
}

export type AttendanceLocationPolicy = {
  required: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
};

export async function getAttendanceLocationPolicy(): Promise<AttendanceLocationPolicy> {
  const rows = await prisma.systemSetting
    .findMany({
      where: {
        key: {
          in: [
            "attendance.require_location",
            "attendance.office_latitude",
            "attendance.office_longitude",
            "attendance.location_radius_meters",
          ],
        },
      },
    })
    .catch(() => []);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const latitude = Number(values.get("attendance.office_latitude"));
  const longitude = Number(values.get("attendance.office_longitude"));
  const radiusMeters = Number(values.get("attendance.location_radius_meters"));
  return {
    required: values.get("attendance.require_location") === "true",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    radiusMeters: Number.isFinite(radiusMeters) && radiusMeters >= 10 ? radiusMeters : 200,
  };
}

export type EmployeeAttendancePolicy = AttendancePolicy & {
  shiftId: string | null;
  shiftCode: string | null;
  shiftName: string | null;
  breakMinutes: number;
  scheduleType: "WEEKDAYS" | "ROTATING";
  workDays: number[];
};

export const DEFAULT_OFFICE_SHIFT_NAME = "ກະຫ້ອງການ";

/** id ຂອງ "ກະເລີ່ມຕົ້ນ" ທີ່ HR ຕັ້ງໄວ້ (ຫຼື null) */
export async function getDefaultShiftId(): Promise<string | null> {
  const setting = await prisma.systemSetting
    .findUnique({ where: { key: "attendance.default_shift_id" } })
    .catch(() => null);
  return setting?.value || null;
}

/** ກະເລີ່ມຕົ້ນ: ໃຊ້ອັນທີ່ຕັ້ງໄວ້ກ່ອນ, ຖ້າບໍ່ມີ → ກະທຳອິດທີ່ເປີດ (ຮຽງຕາມລະຫັດ) */
export async function getDefaultShift() {
  const id = await getDefaultShiftId();
  if (id) {
    const shift = await prisma.workShift
      .findFirst({ where: { id, isActive: true } })
      .catch(() => null);
    if (shift) return shift;
  }
  return prisma.workShift
    .findFirst({ where: { isActive: true }, orderBy: { code: "asc" } })
    .catch(() => null);
}

export async function getEmployeeAttendancePolicy(
  employeeCode: string,
  calendarDate: Date,
): Promise<EmployeeAttendancePolicy> {
  const assignment = await prisma.employeeShiftAssignment
    .findFirst({
      where: {
        employeeCode,
        effectiveFrom: { lte: calendarDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: calendarDate } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: "desc" },
    })
    .catch(() => null);
  if (assignment) {
    return {
      workStart: assignment.shift.startTime,
      workEnd: assignment.shift.endTime,
      lateGraceMinutes: assignment.shift.lateGraceMinutes,
      shiftId: assignment.shift.id,
      shiftCode: assignment.shift.code,
      shiftName: assignment.shift.name,
      breakMinutes: assignment.shift.breakMinutes,
      scheduleType: assignment.shift.scheduleType,
      workDays: assignment.shift.workDays
        .split(",")
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    };
  }
  // ບໍ່ໄດ້ຮັບການມອບກະ → ໃຊ້ "ກະເລີ່ມຕົ້ນ" (ທີ່ HR ຕັ້ງ ຫຼືກະທຳອິດທີ່ເປີດ)
  const defaultShift = await getDefaultShift();
  if (defaultShift) {
    return {
      workStart: defaultShift.startTime,
      workEnd: defaultShift.endTime,
      lateGraceMinutes: defaultShift.lateGraceMinutes,
      shiftId: defaultShift.id,
      shiftCode: defaultShift.code,
      shiftName: defaultShift.name,
      breakMinutes: defaultShift.breakMinutes,
      scheduleType: defaultShift.scheduleType,
      workDays: defaultShift.workDays
        .split(",")
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    };
  }
  // ບໍ່ມີກະໃນລະບົບເລີຍ → ໃຊ້ຄ່າ .env
  return {
    ...DEFAULT_ATTENDANCE_POLICY,
    shiftId: null,
    shiftCode: null,
    shiftName: null,
    breakMinutes: 0,
    scheduleType: "WEEKDAYS",
    workDays: [1, 2, 3, 4, 5],
  };
}

export async function getEmployeeAttendanceContext(employeeCode: string, instant: Date) {
  const calendarDate = laoWorkDate(instant);
  const previousDate = new Date(calendarDate.getTime());
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const [currentPolicy, previousPolicy] = await Promise.all([
    getEmployeeAttendancePolicy(employeeCode, calendarDate),
    getEmployeeAttendancePolicy(employeeCode, previousDate),
  ]);

  const previousWorkDate = workDateForShift(
    instant,
    previousPolicy.workStart,
    previousPolicy.workEnd,
  );
  if (dateKey(previousWorkDate) === dateKey(previousDate)) {
    return { policy: previousPolicy, workDate: previousDate };
  }
  return {
    policy: currentPolicy,
    workDate: workDateForShift(instant, currentPolicy.workStart, currentPolicy.workEnd),
  };
}

export async function getPublicHolidayKeys(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await prisma.publicHoliday
    .findMany({ where: { date: { gte: start, lte: end } }, select: { date: true } })
    .catch(() => []);
  return new Set(holidays.map((holiday) => dateKey(holiday.date)));
}

export async function getEmployeeDayOffKeys(
  employeeCode: string,
  start: Date,
  end: Date,
): Promise<Set<string>> {
  const daysOff = await prisma.employeeDayOff
    .findMany({
      where: { employeeCode, date: { gte: start, lte: end } },
      select: { date: true },
    })
    .catch(() => []);
  return new Set(daysOff.map((day) => dateKey(day.date)));
}
