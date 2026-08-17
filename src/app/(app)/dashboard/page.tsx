import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyRow,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { kip, laoDate } from "@/lib/format";

export default async function DashboardPage() {
  const session = await requireUser();
  const canSeeCost = hasRole(session, "ADMIN", "HR", "EXECUTIVE");

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 864e5);

  const [
    totalActive,
    byDepartment,
    departments,
    withoutProfile,
    probationEnding,
    expiringContracts,
    salaryCost,
    birthdays,
  ] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: "ACTIVE" } }),
    prisma.employee.groupBy({
      by: ["departmentCode"],
      where: { employmentStatus: "ACTIVE" },
      _count: true,
    }),
    prisma.department.findMany(),
    prisma.employee.count({ where: { profile: null } }),
    prisma.employeeProfile.findMany({
      where: {
        hrStatus: "PROBATION",
        probationEndDate: { gte: today, lte: in30Days },
      },
      include: { employee: true },
      orderBy: { probationEndDate: "asc" },
      take: 5,
    }),
    prisma.contract.findMany({
      where: { isActive: true, endDate: { gte: today, lte: in30Days } },
      include: { employee: true },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
    prisma.employeeProfile.aggregate({
      where: { hrStatus: { in: ["ACTIVE", "PROBATION"] } },
      _sum: { baseSalary: true, positionAllowance: true },
    }),
    prisma.$queryRaw<{ employee_code: string; fullname_lo: string; dob: Date }[]>`
      SELECT e.employee_code, e.fullname_lo, p.dob
      FROM hrm_employee_profile p
      JOIN odg_employee e ON e.employee_code = p.employee_code
      WHERE p.dob IS NOT NULL
        AND EXTRACT(MONTH FROM p.dob) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY EXTRACT(DAY FROM p.dob) LIMIT 5`,
  ]);

  const deptName = new Map(departments.map((d) => [d.code, d.nameLo]));

  const monthlyCost =
    Number(salaryCost._sum.baseSalary ?? 0) +
    Number(salaryCost._sum.positionAllowance ?? 0);

  const modules = [
    { href: "/employees", label: "ພະນັກງານ", caption: "ປະຫວັດ ແລະ ສັນຍາ", mark: "ພ", color: "bg-[#714b67]" },
    { href: "/attendance", label: "ລົງເວລາ", caption: "ເຂົ້າ-ອອກວຽກ", mark: "ວ", color: "bg-[#017e84]" },
    { href: "/leave", label: "ລາພັກ", caption: "ຄຳຂໍ ແລະ ການອະນຸມັດ", mark: "ລ", color: "bg-[#e09f3e]" },
    { href: "/overtime", label: "ວຽກລ່ວງເວລາ", caption: "ຄຳຂໍ OT ແລະ ອະນຸມັດ", mark: "+", color: "bg-[#d17a22]" },
    ...(canSeeCost ? [{ href: "/payroll", label: "ເງິນເດືອນ", caption: "ຮອບຈ່າຍ ແລະ payslip", mark: "₭", color: "bg-[#2a7f62]" }] : []),
    { href: "/appraisal", label: "ປະເມີນ", caption: "ຜົນງານ ແລະ KPI", mark: "★", color: "bg-[#536dfe]" },
    { href: "/org", label: "ອົງກອນ", caption: "ຝ່າຍ ແລະ ພະແນກ", mark: "ອ", color: "bg-[#6c757d]" },
    ...(hasRole(session, "ADMIN", "HR") ? [{ href: "/assets", label: "ຊັບສິນ", caption: "ອຸປະກອນ ແລະ ການມອບ", mark: "□", color: "bg-[#4f6d7a]" }] : []),
    ...(hasRole(session, "ADMIN", "HR") ? [{ href: "/settings", label: "ຕັ້ງຄ່າ HR", caption: "ເວລາ, ການລາ ແລະ ວັນພັກ", mark: "⚙", color: "bg-[#665c70]" }] : []),
    ...(hasRole(session, "ADMIN", "HR", "EXECUTIVE") ? [{ href: "/recruitment", label: "ຮັບສະໝັກ", caption: "ຕຳແໜ່ງ ແລະ ຜູ້ສະໝັກ", mark: "+", color: "bg-[#c45c76]" }] : []),
    { href: "/me", label: "ຂໍ້ມູນຂອງຂ້ອຍ", caption: "ປະຫວັດສ່ວນຕົວ", mark: "ຂ", color: "bg-[#5b8c85]" },
  ];

  return (
    <>
      <PageHeader
        title={`ສະບາຍດີ, ${session.name}`}
        subtitle="ສູນກາງການບໍລິຫານຊັບພະຍາກອນບຸກຄົນ"
      />

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">ແອັບຂອງຂ້ອຍ</h2>
          <span className="text-xs text-muted">{modules.length} ໂມດູນ</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(44,30,42,0.05)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-lg font-bold text-white shadow-sm ${module.color}`}>
                {module.mark}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-slate-800 group-hover:text-primary">{module.label}</span>
                <span className="block truncate text-xs text-muted">{module.caption}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="ພະນັກງານທັງໝົດ" value={totalActive} hint="ສະຖານະເຮັດວຽກຢູ່" />
        <StatCard
          label="ຍັງບໍ່ມີຂໍ້ມູນ HR"
          value={withoutProfile}
          tone={withoutProfile > 0 ? "warn" : "good"}
          hint="ຂາດເງິນເດືອນ / ຫົວໜ້າ / ສະຖານະ"
        />
        {canSeeCost ? (
          <StatCard label="ຕົ້ນທຶນເງິນເດືອນ / ເດືອນ" value={kip(monthlyCost)} />
        ) : (
          <StatCard label="ພະແນກ" value={departments.length} />
        )}
      </div>

      {withoutProfile > 0 && canSeeCost && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ມີພະນັກງານ {withoutProfile} ຄົນ ທີ່ຍັງບໍ່ມີຂໍ້ມູນ HR (ເງິນເດືອນ, ຫົວໜ້າ, ສະຖານະ) —{" "}
          <Link href="/employees" className="font-medium underline">
            ໄປເພີ່ມຂໍ້ມູນ
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">ຈຳນວນພະນັກງານແຕ່ລະພະແນກ</h2>
          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {byDepartment
              .sort((a, b) => b._count - a._count)
              .map((d) => {
                const pct = totalActive ? (d._count / totalActive) * 100 : 0;
                return (
                  <li key={d.departmentCode ?? "-"}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{deptName.get(d.departmentCode ?? "") ?? "ບໍ່ລະບຸພະແນກ"}</span>
                      <span className="tabular font-medium">{d._count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">ວັນເກີດເດືອນນີ້</h2>
          {birthdays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              ບໍ່ມີຂໍ້ມູນ (ຕ້ອງໃສ່ວັນເກີດໃນຂໍ້ມູນ HR ກ່ອນ)
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {birthdays.map((b) => (
                <li key={b.employee_code} className="flex justify-between">
                  <Link
                    href={`/employees/${b.employee_code}`}
                    className="text-primary hover:underline"
                  >
                    {b.fullname_lo}
                  </Link>
                  <span className="text-muted">{laoDate(b.dob)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">ພະນັກງານໃກ້ຄົບທົດລອງງານ</h2>
          <Table>
            <thead>
              <tr>
                <Th>ຊື່</Th>
                <Th>ຄົບກຳນົດ</Th>
              </tr>
            </thead>
            <tbody>
              {probationEnding.length === 0 && <EmptyRow colSpan={2} />}
              {probationEnding.map((p) => (
                <tr key={p.employeeCode}>
                  <Td>
                    <Link
                      href={`/employees/${p.employeeCode}`}
                      className="text-primary hover:underline"
                    >
                      {p.employee.fullnameLo}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone="amber">{laoDate(p.probationEndDate)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">ສັນຍາໃກ້ໝົດອາຍຸ</h2>
          <Table>
            <thead>
              <tr>
                <Th>ຊື່</Th>
                <Th>ເລກສັນຍາ</Th>
                <Th>ໝົດອາຍຸ</Th>
              </tr>
            </thead>
            <tbody>
              {expiringContracts.length === 0 && <EmptyRow colSpan={3} />}
              {expiringContracts.map((c) => (
                <tr key={c.id}>
                  <Td>{c.employee.fullnameLo}</Td>
                  <Td>{c.contractNo}</Td>
                  <Td>
                    <Badge tone="red">{laoDate(c.endDate)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
