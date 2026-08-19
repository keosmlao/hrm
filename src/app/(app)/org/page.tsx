import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { Badge, Card, LinkButton, PageHeader, StatCard } from "@/components/ui";
import { HeadPicker } from "./head-picker";
import { OrgChart3D, type ChartNode } from "./org-chart-3d";
import type { OrgScope, Prisma } from "@/generated/prisma/client";
import { ACTIVE_EMPLOYEE } from "@/lib/employee-status";

export default async function OrgPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string; view?: string }>;
}) {
  const session = await requireUser();
  const canManage = hasRole(session, "ADMIN", "HR");
  const { division: requestedDivision, view } = await searchParams;
  const chartView = view === "chart";
  const activeEmployeeWhere: Prisma.EmployeeWhereInput = ACTIVE_EMPLOYEE;

  const [divisions, employees, headcount, orgHeads, positions] =
    await Promise.all([
      prisma.division.findMany({
        orderBy: { code: "asc" },
        include: {
          departments: {
            orderBy: { code: "asc" },
            include: { units: { orderBy: { code: "asc" } } },
          },
        },
      }),
      prisma.employee.findMany({
        where: activeEmployeeWhere,
        select: {
          code: true,
          titleLo: true,
          fullnameLo: true,
          divisionCode: true,
          departmentCode: true,
          unitCode: true,
          positionCode: true,
        },
        orderBy: { code: "asc" },
      }),
      prisma.employee.groupBy({
        by: ["departmentCode"],
        where: activeEmployeeWhere,
        _count: true,
      }),
      prisma.orgHead
        .findMany({
          where: { employee: activeEmployeeWhere },
          include: {
            employee: {
              select: { code: true, titleLo: true, fullnameLo: true },
            },
          },
        })
        // ຖ້າຍັງບໍ່ໄດ້ deploy migration (ຕາຕະລາງບໍ່ມີ) → ບໍ່ສະແດງຫົວໜ້າໄປກ່ອນ
        .catch((e: { code?: string }) => {
          if (e?.code === "P2021") return [];
          throw e;
        }),
      prisma.position.findMany({ select: { code: true, nameLo: true } }),
    ]);

  const empCount = new Map(
    headcount.map((e) => [e.departmentCode ?? "", e._count]),
  );
  const totalEmployees = headcount.reduce((s, e) => s + e._count, 0);
  const totalDepts = divisions.reduce((s, d) => s + d.departments.length, 0);
  const totalUnits = divisions.reduce(
    (s, d) => s + d.departments.reduce((n, dep) => n + dep.units.length, 0),
    0,
  );

  const headName = new Map(
    orgHeads.map((h) => [
      `${h.scope}:${h.code}`,
      {
        code: h.employee.code,
        name: `${h.employee.titleLo ?? ""} ${h.employee.fullnameLo}`.trim(),
      },
    ]),
  );
  const empOptions = employees.map((e) => ({
    code: e.code,
    name: `${e.titleLo ?? ""} ${e.fullnameLo}`.trim(),
  }));
  const positionName = new Map(
    positions.map((position) => [position.code, position.nameLo]),
  );
  const employeesByUnit = new Map<string, typeof employees>();
  const employeesWithoutUnit = new Map<string, typeof employees>();
  for (const employee of employees) {
    const departmentCode = employee.departmentCode ?? "";
    if (employee.unitCode) {
      const key = `${departmentCode}:${employee.unitCode}`;
      if (!employeesByUnit.has(key)) employeesByUnit.set(key, []);
      employeesByUnit.get(key)!.push(employee);
    } else {
      if (!employeesWithoutUnit.has(departmentCode))
        employeesWithoutUnit.set(departmentCode, []);
      employeesWithoutUnit.get(departmentCode)!.push(employee);
    }
  }
  const selectedDivision = divisions.some(
    (division) => division.code === requestedDivision,
  )
    ? requestedDivision
    : divisions[0]?.code;
  const visibleDivisions = divisions.filter(
    (division) => division.code === selectedDivision,
  );

  const head = (scope: OrgScope, code: string) =>
    headName.get(`${scope}:${code}`)?.name ?? null;

  // ຜັງ 3D ສະແດງທັງບໍລິສັດ ບໍ່ຈຳກັດຝ່າຍທີ່ເລືອກ — ຕົວກັ່ນຕອງຢູ່ໃນຜັງເອງ
  const staff = (list: typeof employees): ChartNode[] =>
    list.map((e) => ({
      id: `EMP:${e.code}`,
      kind: "employee" as const,
      code: e.code,
      name: `${e.titleLo ?? ""} ${e.fullnameLo}`.trim(),
      head: e.positionCode
        ? (positionName.get(e.positionCode) ?? e.positionCode)
        : null,
      count: null,
      children: [],
    }));

  const chartRoot: ChartNode = {
    id: "root",
    kind: "root",
    code: "",
    name: "ODIEN GROUP",
    head: null,
    count: totalEmployees,
    children: divisions.map((v) => ({
      id: `DIV:${v.code}`,
      kind: "division" as const,
      code: v.code,
      name: v.nameLo,
      head: head("DIVISION", v.code),
      count: v.departments.reduce((s, d) => s + (empCount.get(d.code) ?? 0), 0),
      children: v.departments.map((d) => {
        const loose = employeesWithoutUnit.get(d.code) ?? [];
        return {
          id: `DEP:${d.code}`,
          kind: "department" as const,
          code: d.code,
          name: d.nameLo,
          head: head("DEPARTMENT", d.code),
          count: empCount.get(d.code) ?? 0,
          children: [
            ...d.units.map((u) => {
              const members = employeesByUnit.get(`${d.code}:${u.code}`) ?? [];
              return {
                id: `UNI:${d.code}:${u.code}`,
                kind: "unit" as const,
                code: u.code,
                name: u.nameLo,
                head: head("UNIT", u.code),
                count: members.length,
                children: staff(members),
              };
            }),
            // ພະນັກງານທີ່ຍັງບໍ່ໄດ້ຈັດເຂົ້າໜ່ວຍງານ — ຢ່າໃຫ້ຫາຍໄປຈາກຜັງ
            ...(loose.length > 0
              ? [
                  {
                    id: `UNI:${d.code}:__none`,
                    kind: "unit" as const,
                    code: "",
                    name: "ບໍ່ລະບຸໜ່ວຍງານ",
                    head: null,
                    count: loose.length,
                    children: staff(loose),
                  },
                ]
              : []),
          ],
        };
      }),
    })),
  };

  function Head({ scope, code }: { scope: OrgScope; code: string }) {
    const head = headName.get(`${scope}:${code}`);
    if (canManage) {
      return (
        <HeadPicker
          scope={scope}
          code={code}
          currentCode={head?.code ?? null}
          employees={empOptions}
        />
      );
    }
    return (
      <span className="text-xs text-muted">
        {head ? `ຫົວໜ້າ: ${head.name}` : "ຍັງບໍ່ໄດ້ກຳນົດຫົວໜ້າ"}
      </span>
    );
  }

  return (
    <>
      <PageHeader
        title="ໂຄງສ້າງອົງກອນ"
        subtitle="ຝ່າຍ → ພະແນກ → ໜ່ວຍງານ · ກຳນົດຫົວໜ້າແຕ່ລະໜ່ວຍ (1 ຄົນເປັນຫົວໜ້າໄດ້ຫຼາຍໜ່ວຍ)"
        action={
          canManage ? (
            <LinkButton href="/settings/units">ກຳນົດໜ່ວຍງານ</LinkButton>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="ຝ່າຍ" value={divisions.length} />
        <StatCard label="ພະແນກ" value={totalDepts} />
        <StatCard label="ໜ່ວຍງານ" value={totalUnits} />
        <StatCard label="ພະນັກງານ" value={totalEmployees} />
      </div>

      <div className="mb-5 inline-flex rounded-xl border border-border bg-card p-1 text-sm">
        {[
          {
            key: "list",
            label: "ລາຍການ",
            href: `/org${selectedDivision ? `?division=${encodeURIComponent(selectedDivision)}` : ""}`,
          },
          { key: "chart", label: "ຜັງ 3D", href: "/org?view=chart" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`rounded-lg px-4 py-1.5 font-medium transition ${
              (t.key === "chart") === chartView
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {chartView && <OrgChart3D root={chartRoot} />}

      {!chartView && divisions.length > 0 && (
        <nav
          aria-label="ເລືອກຝ່າຍ"
          role="tablist"
          className="mb-5 flex gap-1 overflow-x-auto border-b border-border"
        >
          {divisions.map((division) => {
            const active = division.code === selectedDivision;
            return (
              <Link
                key={division.code}
                href={`/org?division=${encodeURIComponent(division.code)}`}
                role="tab"
                aria-selected={active}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:border-slate-300 hover:text-foreground"
                }`}
              >
                {division.nameLo}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {division.code}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {!chartView && (
        <div className="space-y-5">
          {divisions.length === 0 && (
            <Card className="py-10 text-center text-sm text-muted">
              ຍັງບໍ່ມີຂໍ້ມູນຝ່າຍ
            </Card>
          )}
          {visibleDivisions.map((v) => {
            const divHeadcount = v.departments.reduce(
              (s, d) => s + (empCount.get(d.code) ?? 0),
              0,
            );
            return (
              <Card key={v.code}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">{v.nameLo}</h2>
                  <Badge tone="blue">{v.code}</Badge>
                  <div className="ml-auto flex items-center gap-3">
                    <Head scope="DIVISION" code={v.code} />
                    <span className="text-sm text-muted">
                      {divHeadcount} ຄົນ
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {v.departments.length === 0 && (
                    <span className="text-sm text-muted">ຍັງບໍ່ມີພະແນກ</span>
                  )}
                  {v.departments.map((d) => (
                    <div
                      key={d.code}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.nameLo}</span>
                          <Badge>{d.code}</Badge>
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          {empCount.get(d.code) ?? 0} ຄົນ
                        </span>
                      </div>

                      <div className="mb-3">
                        <Head scope="DEPARTMENT" code={d.code} />
                      </div>

                      <div className="space-y-2">
                        {d.units.length === 0 && (
                          <span className="text-xs text-muted">
                            ບໍ່ມີໜ່ວຍງານຍ່ອຍ
                          </span>
                        )}
                        {d.units.map((u) => {
                          const unitEmployees =
                            employeesByUnit.get(`${d.code}:${u.code}`) ?? [];
                          return (
                            <div
                              key={u.code}
                              className="overflow-hidden rounded-lg border border-border bg-slate-50/70"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-700">
                                    {u.nameLo}
                                  </span>
                                  <Badge>{u.code}</Badge>
                                  <span className="text-xs text-muted">
                                    {unitEmployees.length} ຄົນ
                                  </span>
                                </div>
                                <Head scope="UNIT" code={u.code} />
                              </div>
                              <EmployeeList
                                employees={unitEmployees}
                                positionName={positionName}
                              />
                            </div>
                          );
                        })}
                        {(employeesWithoutUnit.get(d.code)?.length ?? 0) >
                          0 && (
                          <div className="overflow-hidden rounded-lg border border-dashed border-border bg-amber-50/40">
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                              <span className="text-sm font-medium text-slate-700">
                                ບໍ່ລະບຸໜ່ວຍງານ
                              </span>
                              <span className="text-xs text-muted">
                                {employeesWithoutUnit.get(d.code)!.length} ຄົນ
                              </span>
                            </div>
                            <EmployeeList
                              employees={employeesWithoutUnit.get(d.code)!}
                              positionName={positionName}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        <Link href="/employees" className="text-primary hover:underline">
          ເບິ່ງຂໍ້ມູນພະນັກງານທັງໝົດ →
        </Link>
      </p>
    </>
  );
}

type OrgEmployee = {
  code: string;
  titleLo: string | null;
  fullnameLo: string;
  positionCode: string | null;
};

function EmployeeList({
  employees,
  positionName,
}: {
  employees: OrgEmployee[];
  positionName: Map<string, string>;
}) {
  if (employees.length === 0) {
    return (
      <p className="border-t border-border px-3 py-3 text-xs text-muted">
        ຍັງບໍ່ມີພະນັກງານ
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border border-t border-border bg-white">
      {employees.map((employee) => (
        <li key={employee.code}>
          <Link
            href={`/employees/${employee.code}`}
            className="flex items-center gap-3 px-3 py-2 text-sm transition hover:bg-primary/5"
          >
            <span className="w-16 shrink-0 text-xs tabular text-muted">
              {employee.code}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-primary">
              {`${employee.titleLo ?? ""} ${employee.fullnameLo}`.trim()}
            </span>
            <span className="max-w-40 shrink-0 truncate text-xs text-muted">
              {employee.positionCode
                ? (positionName.get(employee.positionCode) ??
                  employee.positionCode)
                : "-"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const dynamic = "force-dynamic";
