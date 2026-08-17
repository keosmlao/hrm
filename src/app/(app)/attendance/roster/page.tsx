import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { currentLaoMonth, dateKey, monthRange } from "@/lib/attendance";
import { RosterEditor } from "./roster-editor";
import { RosterGrid } from "./roster-grid";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employee?: string; dept?: string; view?: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const query = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : currentLaoMonth();
  const view = query.view === "grid" ? "grid" : "single";
  const { start, end } = monthRange(month);

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { employmentStatus: "ACTIVE" },
      select: { code: true, fullnameLo: true, departmentCode: true },
      orderBy: { code: "asc" },
    }),
    prisma.department.findMany({ orderBy: { code: "asc" }, select: { code: true, nameLo: true } }),
  ]);

  const tab = (label: string, target: "single" | "grid", extra = "") =>
    `/attendance/roster?view=${target}&month=${month}${extra}`;

  return (
    <>
      <PageHeader
        title="ຕາຕະລາງວັນພັກລາຍເດືອນ"
        subtitle="ກຳນົດວັນພັກທີ່ບໍ່ຄືກັນຂອງແຕ່ລະພະນັກງານ"
        action={<Link href="/attendance" className="text-sm text-primary hover:underline">← ກັບໄປ Attendance</Link>}
      />

      <div className="mb-5 flex gap-1 border-b border-border">
        <Link
          href={tab("", "single")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            view === "single" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          ລາຍຄົນ
        </Link>
        <Link
          href={tab("", "grid")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            view === "grid" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          ຕາຕະລາງລວມ (ຫຼາຍຄົນ)
        </Link>
      </div>

      {view === "single" ? (
        <SingleView month={month} employees={employees} start={start} end={end} query={query} />
      ) : (
        <GridView
          month={month}
          departments={departments}
          employees={employees}
          start={start}
          end={end}
          query={query}
        />
      )}
    </>
  );
}

// ── ໂໝດ ລາຍຄົນ (ປະຕິທິນຄົນດຽວ) ──
async function SingleView({
  month,
  employees,
  start,
  end,
  query,
}: {
  month: string;
  employees: { code: string; fullnameLo: string }[];
  start: Date;
  end: Date;
  query: { employee?: string };
}) {
  const employeeCode = employees.some((e) => e.code === query.employee)
    ? query.employee!
    : employees[0]?.code;

  const [daysOff, holidays] = employeeCode
    ? await Promise.all([
        prisma.employeeDayOff.findMany({ where: { employeeCode, date: { gte: start, lte: end } }, orderBy: { date: "asc" } }),
        prisma.publicHoliday.findMany({ where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } }),
      ])
    : [[], []];

  return (
    <>
      <form className="mb-5 flex flex-wrap gap-3">
        <input type="hidden" name="view" value="single" />
        <input name="month" type="month" defaultValue={month} className={`${inputClass} max-w-48`} />
        <Combobox
          name="employee"
          defaultValue={employeeCode}
          className="w-full max-w-sm"
          options={employees.map((e) => ({ value: e.code, label: `${e.code} · ${e.fullnameLo}` }))}
        />
        <button className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-slate-50">ສະແດງ</button>
      </form>
      {employeeCode && (
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{employees.find((e) => e.code === employeeCode)?.fullnameLo}</h2>
            <p className="text-xs text-muted">ກົດວັນທີເພື່ອເລືອກ/ຍົກເລີກວັນພັກ</p>
          </div>
          <RosterEditor
            employeeCode={employeeCode}
            month={month}
            initialDaysOff={daysOff.map((item) => dateKey(item.date))}
            holidays={Object.fromEntries(holidays.map((h) => [dateKey(h.date), h.name]))}
          />
        </Card>
      )}
    </>
  );
}

// ── ໂໝດ ຕາຕະລາງລວມ (ພະນັກງານ × ວັນ ຕໍ່ພະແນກ) ──
async function GridView({
  month,
  departments,
  employees,
  start,
  end,
  query,
}: {
  month: string;
  departments: { code: string; nameLo: string }[];
  employees: { code: string; fullnameLo: string; departmentCode: string | null }[];
  start: Date;
  end: Date;
  query: { dept?: string };
}) {
  const dept = departments.some((d) => d.code === query.dept) ? query.dept! : departments[0]?.code;
  const gridEmployees = employees.filter((e) => e.departmentCode === dept);
  const codes = gridEmployees.map((e) => e.code);

  const [daysOff, holidays] = await Promise.all([
    prisma.employeeDayOff.findMany({
      where: { employeeCode: { in: codes }, date: { gte: start, lte: end } },
      select: { employeeCode: true, date: true },
    }),
    prisma.publicHoliday.findMany({ where: { date: { gte: start, lte: end } }, select: { date: true, name: true } }),
  ]);

  const initial: Record<string, string[]> = {};
  for (const d of daysOff) (initial[d.employeeCode] ??= []).push(dateKey(d.date));

  return (
    <>
      <form className="mb-5 flex flex-wrap gap-3">
        <input type="hidden" name="view" value="grid" />
        <input name="month" type="month" defaultValue={month} className={`${inputClass} max-w-48`} />
        <Combobox
          name="dept"
          defaultValue={dept ?? ""}
          className="w-full max-w-xs"
          options={departments.map((d) => ({ value: d.code, label: d.nameLo }))}
        />
        <button className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-slate-50">ສະແດງ</button>
      </form>
      <RosterGrid
        month={month}
        employees={gridEmployees.map((e) => ({ code: e.code, name: `${e.code} · ${e.fullnameLo}` }))}
        initial={initial}
        holidays={Object.fromEntries(holidays.map((h) => [dateKey(h.date), h.name]))}
      />
    </>
  );
}
