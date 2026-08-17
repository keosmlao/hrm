import { prisma } from "@/lib/prisma";
import { requireUser, canViewAllEmployees, hasRole } from "@/lib/auth";
import {
  Badge,
  EmptyRow,
  LinkButton,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { MONTH_LAO } from "@/lib/format";
import {
  attendanceCycleRange,
  currentAttendanceCycleMonth,
  dateKey,
  eachScheduledWorkingDay,
  fmtMinutes,
  laoWorkDate,
} from "@/lib/attendance";
import {
  DEFAULT_OFFICE_SHIFT_NAME,
  getAttendanceCyclePolicy,
  getAttendancePolicy,
  getPublicHolidayKeys,
} from "@/lib/hrm-settings";
import type { Prisma } from "@/generated/prisma/client";
import { ACTIVE_EMPLOYEE } from "@/lib/employee-status";

export const dynamic = "force-dynamic";

type Row = {
  code: string;
  name: string;
  shift: string;
  expected: number;
  present: number;
  late: number;
  lateMinutes: number;
  leave: number;
  absent: number;
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireUser();
  const { month: monthParam } = await searchParams;
  const cyclePolicy = await getAttendanceCyclePolicy();
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? (monthParam as string)
    : currentAttendanceCycleMonth(new Date(), cyclePolicy.endDay);

  const { start, end } = attendanceCycleRange(month, cyclePolicy.endDay);
  const today = laoWorkDate(new Date());
  // ນັບເຖິງມື້ນີ້ເທົ່ານັ້ນ (ບໍ່ນັບວັນອະນາຄົດວ່າ "ຂາດ")
  const rangeEnd = end.getTime() < today.getTime() ? end : today;
  const [policy, holidayKeys] = await Promise.all([
    getAttendancePolicy(),
    getPublicHolidayKeys(start, rangeEnd),
  ]);
  // ── ຂອບເຂດພະນັກງານຕາມສິດ (ຄືກັບໜ້າຂໍ້ມູນພະນັກງານ) ──
  const where: Prisma.EmployeeWhereInput = {
    employmentStatus: "ACTIVE",
    AND: [ACTIVE_EMPLOYEE],
  };
  if (!canViewAllEmployees(session)) {
    const scope = session.role === "MANAGER"
      ? { OR: [{ profile: { managerCode: session.employeeCode ?? "" } }, { code: session.employeeCode ?? "" }] }
      : { code: session.employeeCode ?? "" };
    (where.AND as Prisma.EmployeeWhereInput[]).push(scope);
  }

  const employees = await prisma.employee.findMany({
    where,
    select: { code: true, titleLo: true, fullnameLo: true, hireDate: true },
    orderBy: { code: "asc" },
  });
  const codes = employees.map((e) => e.code);

  const [attendance, leaves, shiftAssignments, employeeDaysOff, defaultShift] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeCode: { in: codes }, workDate: { gte: start, lte: end } },
      select: {
        employeeCode: true,
        workDate: true,
        checkInAt: true,
        lateMinutes: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeCode: { in: codes },
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { employeeCode: true, startDate: true, endDate: true },
    }),
    prisma.employeeShiftAssignment.findMany({
      where: {
        employeeCode: { in: codes },
        effectiveFrom: { lte: rangeEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.employeeDayOff.findMany({
      where: { employeeCode: { in: codes }, date: { gte: start, lte: rangeEnd } },
      select: { employeeCode: true, date: true },
    }),
    prisma.workShift.findFirst({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const shiftsByEmployee = new Map<string, typeof shiftAssignments>();
  for (const assignment of shiftAssignments) {
    if (!shiftsByEmployee.has(assignment.employeeCode)) shiftsByEmployee.set(assignment.employeeCode, []);
    shiftsByEmployee.get(assignment.employeeCode)!.push(assignment);
  }

  const dayOffByEmployee = new Map<string, Set<string>>();
  for (const dayOff of employeeDaysOff) {
    if (!dayOffByEmployee.has(dayOff.employeeCode)) {
      dayOffByEmployee.set(dayOff.employeeCode, new Set());
    }
    dayOffByEmployee.get(dayOff.employeeCode)!.add(dateKey(dayOff.date));
  }

  // ── ຈັດ index: ການລົງເວລາ ແລະ ວັນລາ ຕໍ່ພະນັກງານ ──
  const attByEmp = new Map<string, Map<string, { present: boolean; lateMinutes: number }>>();
  for (const a of attendance) {
    if (!attByEmp.has(a.employeeCode)) attByEmp.set(a.employeeCode, new Map());
    attByEmp.get(a.employeeCode)!.set(dateKey(a.workDate), {
      present: !!a.checkInAt,
      lateMinutes: a.lateMinutes,
    });
  }

  const leaveByEmp = new Map<string, Set<string>>();
  for (const lv of leaves) {
    if (!leaveByEmp.has(lv.employeeCode)) leaveByEmp.set(lv.employeeCode, new Set());
    const set = leaveByEmp.get(lv.employeeCode)!;
    for (const d of eachScheduledWorkingDay(lv.startDate, lv.endDate, true)) {
      set.add(dateKey(d));
    }
  }

  const rows: Row[] = employees.map((e) => {
    const att = attByEmp.get(e.code);
    const leaveSet = leaveByEmp.get(e.code);
    const assignments = shiftsByEmployee.get(e.code) ?? [];
    const excludedDates = new Set(holidayKeys);
    for (const date of dayOffByEmployee.get(e.code) ?? []) excludedDates.add(date);
    const employeeWorkingDays: Date[] = [];
    const shiftLabels = new Set<string>();
    // ເລີ່ມນັບຈາກວັນເລີ່ມວຽກ (ຄົນເຂົ້າໃໝ່ກາງຮອບ ບໍ່ຖືກນັບຂາດກ່ອນເຂົ້າ)
    const empStart = e.hireDate && e.hireDate.getTime() > start.getTime() ? e.hireDate : start;
    for (const cursor = new Date(empStart.getTime()); cursor <= rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const assignment = assignments.find(
        (item) => item.effectiveFrom <= cursor && (!item.effectiveTo || item.effectiveTo >= cursor),
      );
      const shift = assignment?.shift ?? defaultShift;
      const workDays = shift
        ? new Set(shift.workDays.split(",").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
        : new Set([1, 2, 3, 4, 5]);
      if (workDays.has(cursor.getUTCDay()) && !excludedDates.has(dateKey(cursor))) {
        employeeWorkingDays.push(new Date(cursor.getTime()));
        shiftLabels.add(shift
          ? `${shift.name} ${shift.startTime}–${shift.endTime}`
          : `${DEFAULT_OFFICE_SHIFT_NAME} ${policy.workStart}–${policy.workEnd}`);
      }
    }
    let present = 0;
    let late = 0;
    let lateMinutes = 0;
    let leave = 0;
    let absent = 0;
    for (const day of employeeWorkingDays) {
      const k = dateKey(day);
      const rec = att?.get(k);
      if (rec?.present) {
        present++;
        if (rec.lateMinutes > 0) late++;
        lateMinutes += rec.lateMinutes;
      } else if (leaveSet?.has(k)) {
        leave++;
      } else if (day.getTime() < today.getTime()) {
        // ວັນນີ້ຍັງບໍ່ນັບເປັນ "ຂາດ" ຈົນກວ່າຈະຜ່ານໄປ (ອາດຍັງເຂົ້າວຽກ/ຂໍລາ)
        absent++;
      }
    }
    return {
      code: e.code,
      name: `${e.titleLo ?? ""} ${e.fullnameLo}`.trim(),
      shift: shiftLabels.size > 1
        ? `ຫຼາຍກະ (${shiftLabels.size})`
        : ([...shiftLabels][0] ?? `${DEFAULT_OFFICE_SHIFT_NAME} ${policy.workStart}–${policy.workEnd}`),
      expected: employeeWorkingDays.length,
      present,
      late,
      lateMinutes,
      leave,
      absent,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      late: acc.late + r.late,
      leave: acc.leave + r.leave,
      absent: acc.absent + r.absent,
    }),
    { late: 0, leave: 0, absent: 0 },
  );

  const [y, m] = month.split("-").map(Number);
  const monthLabel = `${MONTH_LAO[m - 1]} ${y}`;
  const cycleDate = (date: Date) =>
    `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  const cycleLabel = `${cycleDate(start)}–${cycleDate(end)}`;

  // ຕົວເລືອກເດືອນ (12 ເດືອນຫຼ້າສຸດ)
  const monthOptions: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const val = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const optionRange = attendanceCycleRange(val, cyclePolicy.endDay);
    monthOptions.push({
      value: val,
      label: `${MONTH_LAO[d.getUTCMonth()]} ${d.getUTCFullYear()} (${cycleDate(optionRange.start)}–${cycleDate(optionRange.end)})`,
    });
  }

  return (
    <>
      <PageHeader
        title="ສະຫຼຸບການລົງເວລາ"
        subtitle={`${monthLabel} · ຮອບ ${cycleLabel} · ຄິດຕາມກະ ແລະຕາຕະລາງລາຍຄົນ · ວັນພັກບໍລິສັດ ${holidayKeys.size} ວັນ · ຄ່າເລີ່ມຕົ້ນ ${policy.workStart}–${policy.workEnd}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/attendance/corrections" variant="ghost">ຂໍແກ້ໄຂເວລາ</LinkButton>
            {hasRole(session, "ADMIN", "HR") && <LinkButton href="/attendance/roster" variant="ghost">ຈັດຕາຕະລາງວັນພັກ</LinkButton>}
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-3">
        <Combobox
          name="month"
          defaultValue={month}
          className="w-full max-w-md"
          options={monthOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <button className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-slate-50">
          ສະແດງ
        </button>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="ມາຊ້າ (ຄັ້ງ)" value={totals.late} tone={totals.late > 0 ? "warn" : "good"} />
        <StatCard label="ລາພັກ (ວັນ-ຄົນ)" value={totals.leave} />
        <StatCard label="ຂາດວຽກ (ວັນ-ຄົນ)" value={totals.absent} tone={totals.absent > 0 ? "bad" : "good"} />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ລະຫັດ</Th>
            <Th>ຊື່ ແລະ ນາມສະກຸນ</Th>
            <Th>ກະເຮັດວຽກ</Th>
            <Th className="text-center">ຕ້ອງມາ</Th>
            <Th className="text-center">ມາວຽກ</Th>
            <Th className="text-center">ມາຊ້າ</Th>
            <Th className="text-center">ລວມຊ້າ</Th>
            <Th className="text-center">ລາ</Th>
            <Th className="text-center">ຂາດ</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={9} />}
          {rows.map((r) => (
            <tr key={r.code} className="hover:bg-slate-50">
              <Td className="tabular font-medium">{r.code}</Td>
              <Td>{r.name}</Td>
              <Td className="whitespace-nowrap text-xs text-muted">{r.shift}</Td>
              <Td className="text-center tabular">{r.expected}</Td>
              <Td className="text-center tabular">{r.present}</Td>
              <Td className="text-center">
                {r.late > 0 ? <Badge tone="amber">{r.late}</Badge> : <span className="text-muted">0</span>}
              </Td>
              <Td className="text-center text-xs text-muted">{fmtMinutes(r.lateMinutes)}</Td>
              <Td className="text-center">
                {r.leave > 0 ? <Badge tone="blue">{r.leave}</Badge> : <span className="text-muted">0</span>}
              </Td>
              <Td className="text-center">
                {r.absent > 0 ? <Badge tone="red">{r.absent}</Badge> : <span className="text-muted">0</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <p className="mt-3 text-xs text-muted">
        ໝາຍເຫດ: “ຂາດ” = ວັນເຮັດວຽກຕາມກະທີ່ບໍ່ໄດ້ລົງເວລາ ແລະບໍ່ມີການລາທີ່ອະນຸມັດ ·
        ວັນພັກລາຍຄົນ ແລະວັນພັກທີ່ກຳນົດໃນ Settings ຈະບໍ່ຖືກນັບເປັນຂາດ
      </p>
    </>
  );
}
