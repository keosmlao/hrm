import "server-only";

import { prisma } from "./prisma";
import { getEmployeeAttendancePolicy } from "./hrm-settings";

export type OvertimeRateType = "WORKDAY" | "DAY_OFF" | "HOLIDAY";

export type OvertimeRatePolicy = {
  workdayRate: number;
  dayOffRate: number;
  holidayRate: number;
};

export const DEFAULT_OVERTIME_RATE_POLICY: OvertimeRatePolicy = {
  workdayRate: 1.5,
  dayOffRate: 2,
  holidayRate: 3,
};

export const OVERTIME_RATE_LABEL: Record<OvertimeRateType, string> = {
  WORKDAY: "ວັນເຮັດວຽກປົກກະຕິ",
  DAY_OFF: "ວັນພັກຕາມຕາຕະລາງ",
  HOLIDAY: "ວັນພັກບໍລິສັດ/ວັນບຸນ",
};

function validRate(value: string | undefined, fallback: number): number {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 1 && rate <= 10 ? rate : fallback;
}

export async function getOvertimeRatePolicy(): Promise<OvertimeRatePolicy> {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ["overtime.workday_rate", "overtime.day_off_rate", "overtime.holiday_rate"],
      },
    },
  }).catch(() => []);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    workdayRate: validRate(values.get("overtime.workday_rate"), DEFAULT_OVERTIME_RATE_POLICY.workdayRate),
    dayOffRate: validRate(values.get("overtime.day_off_rate"), DEFAULT_OVERTIME_RATE_POLICY.dayOffRate),
    holidayRate: validRate(values.get("overtime.holiday_rate"), DEFAULT_OVERTIME_RATE_POLICY.holidayRate),
  };
}

export async function overtimeRateForEmployee(
  employeeCode: string,
  workDate: Date,
): Promise<{ rate: number; rateType: OvertimeRateType }> {
  const [rates, shift, holiday, dayOff] = await Promise.all([
    getOvertimeRatePolicy(),
    getEmployeeAttendancePolicy(employeeCode, workDate),
    prisma.publicHoliday.findUnique({ where: { date: workDate }, select: { id: true } }),
    prisma.employeeDayOff.findUnique({
      where: { employeeCode_date: { employeeCode, date: workDate } },
      select: { id: true },
    }),
  ]);
  if (holiday) return { rate: rates.holidayRate, rateType: "HOLIDAY" };
  if (dayOff || !shift.workDays.includes(workDate.getUTCDay())) {
    return { rate: rates.dayOffRate, rateType: "DAY_OFF" };
  }
  return { rate: rates.workdayRate, rateType: "WORKDAY" };
}
