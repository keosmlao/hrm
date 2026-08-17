"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computePay, hourlyRate, dailyRate } from "@/lib/payroll";
import { attendanceCycleRange, dateKey, eachScheduledWorkingDay, laoWorkDate } from "@/lib/attendance";
import { getAttendanceCyclePolicy } from "@/lib/hrm-settings";
import type { PayrollStatus } from "@/generated/prisma/client";
import { ACTIVE_EMPLOYEE } from "@/lib/employee-status";

/** ສ້າງຮອບເງິນເດືອນ (ປີ/ເດືອນ) */
export async function createPeriod(_prev: { error?: string }, fd: FormData) {
  await requireRole("ADMIN", "HR");
  const year = Number(fd.get("year"));
  const month = Number(fd.get("month"));
  if (!year || !month || month < 1 || month > 12) return { error: "ປີ/ເດືອນ ບໍ່ຖືກຕ້ອງ" };

  const exists = await prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } });
  if (exists) return { error: "ຮອບເດືອນນີ້ມີແລ້ວ" };

  const cyclePolicy = await getAttendanceCyclePolicy();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const range = attendanceCycleRange(monthKey, cyclePolicy.endDay);

  const period = await prisma.payrollPeriod.create({
    data: {
      year,
      month,
      startDate: range.start,
      endDate: range.end,
    },
  });
  revalidatePath("/payroll");
  redirect(`/payroll/${period.id}`);
}

/** ຄິດໄລ່/ສ້າງສະລິບເງິນເດືອນ ໃຫ້ພະນັກງານທຸກຄົນທີ່ມີຂໍ້ມູນເງິນເດືອນ */
export async function generatePayslips(periodId: string) {
  await requireRole("ADMIN", "HR");
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.status === "PAID" || period.status === "CLOSED") return;

  const today = laoWorkDate(new Date());
  const calculationEnd = period.endDate < today ? period.endDate : today;
  const [employees, otAll, unpaidTypes, attendance, assignments, daysOff, holidays, approvedLeaves, defaultShift] = await Promise.all([
    prisma.employee.findMany({
      where: ACTIVE_EMPLOYEE,
      include: { profile: true },
    }),
    prisma.overtimeRequest.findMany({
      where: {
        status: "APPROVED",
        workDate: { gte: period.startDate, lte: period.endDate },
      },
      select: { employeeCode: true, hours: true, rate: true },
    }),
    prisma.leaveType.findMany({ where: { isPaid: false }, select: { id: true } }),
    prisma.attendance.findMany({
      where: { workDate: { gte: period.startDate, lte: calculationEnd } },
      select: { employeeCode: true, workDate: true, checkInAt: true, lateMinutes: true },
    }),
    prisma.employeeShiftAssignment.findMany({
      where: {
        effectiveFrom: { lte: calculationEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.employeeDayOff.findMany({
      where: { date: { gte: period.startDate, lte: calculationEnd } },
      select: { employeeCode: true, date: true },
    }),
    prisma.publicHoliday.findMany({
      where: { date: { gte: period.startDate, lte: calculationEnd } },
      select: { date: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: calculationEnd },
        endDate: { gte: period.startDate },
      },
      select: { employeeCode: true, leaveTypeId: true, startDate: true, endDate: true },
    }),
    prisma.workShift.findFirst({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const unpaidTypeIds = unpaidTypes.map((t) => t.id);
  // ຈັດກຸ່ມຕໍ່ພະນັກງານ
  const otByEmp = new Map<string, { hours: number; rate: number }[]>();
  for (const o of otAll) {
    if (!otByEmp.has(o.employeeCode)) otByEmp.set(o.employeeCode, []);
    otByEmp.get(o.employeeCode)!.push({ hours: o.hours, rate: o.rate });
  }
  const attendanceByEmp = new Map<string, Map<string, { present: boolean; lateMinutes: number }>>();
  for (const row of attendance) {
    if (!attendanceByEmp.has(row.employeeCode)) attendanceByEmp.set(row.employeeCode, new Map());
    attendanceByEmp.get(row.employeeCode)!.set(dateKey(row.workDate), {
      present: !!row.checkInAt,
      lateMinutes: row.lateMinutes,
    });
  }
  const assignmentsByEmp = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    if (!assignmentsByEmp.has(assignment.employeeCode)) assignmentsByEmp.set(assignment.employeeCode, []);
    assignmentsByEmp.get(assignment.employeeCode)!.push(assignment);
  }
  const daysOffByEmp = new Map<string, Set<string>>();
  for (const item of daysOff) {
    if (!daysOffByEmp.has(item.employeeCode)) daysOffByEmp.set(item.employeeCode, new Set());
    daysOffByEmp.get(item.employeeCode)!.add(dateKey(item.date));
  }
  const holidayKeys = new Set(holidays.map((item) => dateKey(item.date)));
  const leaveByEmp = new Map<string, Set<string>>();
  const unpaidLeaveByEmp = new Map<string, Set<string>>();
  const unpaidTypeSet = new Set(unpaidTypeIds);
  for (const leave of approvedLeaves) {
    if (!leaveByEmp.has(leave.employeeCode)) leaveByEmp.set(leave.employeeCode, new Set());
    if (!unpaidLeaveByEmp.has(leave.employeeCode)) unpaidLeaveByEmp.set(leave.employeeCode, new Set());
    const start = leave.startDate < period.startDate ? period.startDate : leave.startDate;
    const end = leave.endDate > calculationEnd ? calculationEnd : leave.endDate;
    for (const date of eachScheduledWorkingDay(start, end, true)) {
      leaveByEmp.get(leave.employeeCode)!.add(dateKey(date));
      if (unpaidTypeSet.has(leave.leaveTypeId)) unpaidLeaveByEmp.get(leave.employeeCode)!.add(dateKey(date));
    }
  }

  const rows = employees.map((e) => {
    const base = Number(e.profile!.baseSalary);
    const positionAllowance = Number(e.profile!.positionAllowance);
    const hourly = hourlyRate(base);
    const otAmount = Math.round(
      (otByEmp.get(e.code) ?? []).reduce((s, o) => s + o.hours * o.rate * hourly, 0),
    );
    const employeeAssignments = assignmentsByEmp.get(e.code) ?? [];
    const employeeAttendance = attendanceByEmp.get(e.code);
    const employeeLeave = leaveByEmp.get(e.code) ?? new Set<string>();
    const employeeUnpaidLeave = unpaidLeaveByEmp.get(e.code) ?? new Set<string>();
    const employeeDaysOff = daysOffByEmp.get(e.code) ?? new Set<string>();
    let lateMinutes = 0;
    let absentDays = 0;
    let unpaidDays = 0;
    for (const cursor = new Date(period.startDate); cursor <= calculationEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = dateKey(cursor);
      const assignment = employeeAssignments.find(
        (item) => item.effectiveFrom <= cursor && (!item.effectiveTo || item.effectiveTo >= cursor),
      );
      const shift = assignment?.shift ?? defaultShift;
      const weekdays = shift
        ? new Set(shift.workDays.split(",").map(Number).filter((day) => Number.isInteger(day)))
        : new Set([1, 2, 3, 4, 5]);
      if (!weekdays.has(cursor.getUTCDay()) || holidayKeys.has(key) || employeeDaysOff.has(key)) continue;
      const record = employeeAttendance?.get(key);
      if (record?.present) lateMinutes += Math.max(0, record.lateMinutes);
      else if (!employeeLeave.has(key)) absentDays++;
      if (employeeUnpaidLeave.has(key)) unpaidDays++;
    }
    const lateDeduction = Math.round((lateMinutes / 60) * hourly);
    const absentDeduction = Math.round(absentDays * dailyRate(base));
    const otherDeductions = Math.round(unpaidDays * dailyRate(base));

    const pay = computePay({ baseSalary: base, positionAllowance, otAmount, lateDeduction, absentDeduction, otherDeductions });

    return {
      employeeCode: e.code,
      periodId,
      baseSalary: base,
      positionAllowance,
      otAmount,
      lateDeduction,
      absentDeduction,
      otherDeductions,
      socialSecurity: pay.socialSecurity,
      incomeTax: pay.incomeTax,
      grossPay: pay.grossPay,
      totalDeduction: pay.totalDeduction,
      netPay: pay.netPay,
      note: [
        lateMinutes > 0 ? `ມາຊ້າ ${lateMinutes} ນາທີ` : null,
        absentDays > 0 ? `ຂາດ ${absentDays} ວັນ` : null,
        unpaidDays > 0 ? `ລາບໍ່ຮັບເງິນ ${unpaidDays} ວັນ` : null,
      ].filter(Boolean).join(" · ") || null,
    };
  });

  await prisma.$transaction([
    prisma.payslip.deleteMany({ where: { periodId } }),
    prisma.payslip.createMany({ data: rows }),
    prisma.payrollPeriod.update({ where: { id: periodId }, data: { status: "CALCULATED" } }),
  ]);

  revalidatePath(`/payroll/${periodId}`);
}

export async function setPeriodStatus(periodId: string, status: PayrollStatus) {
  await requireRole("ADMIN", "HR");
  const data =
    status === "PAID"
      ? { status, payDate: new Date() }
      : { status };
  await prisma.payrollPeriod.update({ where: { id: periodId }, data });
  revalidatePath(`/payroll/${periodId}`);
  revalidatePath("/payroll");
}

export async function deletePeriod(periodId: string) {
  await requireRole("ADMIN", "HR");
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.status === "PAID" || period.status === "CLOSED") return;
  await prisma.payrollPeriod.delete({ where: { id: periodId } });
  revalidatePath("/payroll");
  redirect("/payroll");
}
