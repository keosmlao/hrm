import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canViewAllEmployees } from "@/lib/auth";
import {
  Badge,
  EmptyRow,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  inputClass,
} from "@/components/ui";
import {
  EMPLOYMENT_STATUS_LABEL,
  HR_STATUS_LABEL,
  HR_STATUS_TONE,
} from "@/lib/labels";
import { Combobox } from "@/components/combobox";
import type { Prisma } from "@/generated/prisma/client";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; emp?: string; status?: string; page?: string }>;
}) {
  const session = await requireUser();
  const { q, status, emp: empRaw, page: pageRaw } = await searchParams;
  const emp = empRaw ?? "ACTIVE";
  const PAGE_SIZE = 20;
  const page = Math.max(1, Number(pageRaw) || 1);

  const where: Prisma.EmployeeWhereInput = {};
  if (!canViewAllEmployees(session)) {
    where.OR =
      session.role === "MANAGER"
        ? [
            { profile: { managerCode: session.employeeCode ?? "" } },
            { code: session.employeeCode ?? "" },
          ]
        : [{ code: session.employeeCode ?? "" }];
  }

  const and: Prisma.EmployeeWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { fullnameLo: { contains: q, mode: "insensitive" } },
        { fullnameEn: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
      ],
    });
  }
  if (emp === "ACTIVE") and.push({ employmentStatus: "ACTIVE" });
  else if (emp === "LEFT") and.push({ employmentStatus: { not: "ACTIVE" } });
  if (status) and.push({ profile: { hrStatus: status as never } });
  if (and.length) where.AND = and;

  const [employees, total, divisions, departments, units, positions] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        code: true,
        titleLo: true,
        fullnameLo: true,
        nickname: true,
        positionCode: true,
        divisionCode: true,
        departmentCode: true,
        unitCode: true,
        mobile: true,
        employmentStatus: true,
        profile: { select: { hrStatus: true } },
      },
      orderBy: { code: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.employee.count({ where }),
    prisma.division.findMany({ select: { code: true, nameLo: true } }),
    prisma.department.findMany({ select: { code: true, nameLo: true } }),
    prisma.unit.findMany({ select: { code: true, nameLo: true } }),
    prisma.position.findMany({ select: { code: true, nameLo: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (emp !== "ACTIVE") params.set("emp", emp);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/employees?${qs}` : "/employees";
  };
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, Math.max(page + 2, 5));
  const pageNumbers: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pageNumbers.push(p);

  const divName = new Map(divisions.map((item) => [item.code, item.nameLo]));
  const deptName = new Map(departments.map((item) => [item.code, item.nameLo]));
  const unitName = new Map(units.map((item) => [item.code, item.nameLo]));
  const posName = new Map(positions.map((item) => [item.code, item.nameLo]));
  const labelFor = (map: Map<string, string>, code: string | null) =>
    code ? (map.get(code) ?? code) : "-";
  const canEdit = session.role === "ADMIN" || session.role === "HR";

  return (
    <>
      <PageHeader
        title="ຂໍ້ມູນພະນັກງານ"
        subtitle={`ພົບ ${total} ຄົນ · ໜ້າ ${page}/${totalPages}`}
        action={canEdit ? <LinkButton href="/employees/new">+ ເພີ່ມພະນັກງານ</LinkButton> : null}
      />

      <form className="mb-4 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="ຄົ້ນຫາ ຊື່ / ຊື່ຫຼິ້ນ / ລະຫັດ / ເບີໂທ"
          className={`${inputClass} max-w-sm`}
        />
        <Combobox
          name="emp"
          defaultValue={emp}
          className="w-40"
          options={[
            { value: "ACTIVE", label: "ເຮັດວຽກຢູ່" },
            { value: "LEFT", label: "ລາອອກ" },
            { value: "ALL", label: "ທັງໝົດ" },
          ]}
        />
        <Combobox
          name="status"
          defaultValue={status ?? ""}
          className="w-48"
          options={[
            { value: "", label: "ທຸກສະຖານະ HR" },
            ...Object.entries(HR_STATUS_LABEL).map(([key, label]) => ({ value: key, label })),
          ]}
        />
        <button className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-slate-50">
          ຄົ້ນຫາ
        </button>
      </form>

      <Table>
        <thead>
          <tr>
            <Th className="w-14 text-center">ລ/ດ</Th>
            <Th>ລະຫັດ</Th>
            <Th>ຊື່ພະນັກງານ</Th>
            <Th>ຊື່ຫຼິ້ນ</Th>
            <Th>ຕຳແໜ່ງ</Th>
            <Th>ຝ່າຍ</Th>
            <Th>ພະແນກ / ໜ່ວຍງານ</Th>
            <Th>ເບີໂທ</Th>
            <Th>ສະຖານະ HR</Th>
            <Th>ສະຖານະການຈ້າງ</Th>
            <Th className="text-right">ຈັດການ</Th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && <EmptyRow colSpan={11} text="ບໍ່ພົບພະນັກງານ" />}
          {employees.map((employee, index) => {
            const hrStatus = employee.profile?.hrStatus;
            const employmentStatus = employee.employmentStatus ?? "INACTIVE";
            return (
              <tr key={employee.code} className="transition hover:bg-primary/5">
                <Td className="text-center text-muted tabular">{(page - 1) * PAGE_SIZE + index + 1}</Td>
                <Td className="font-medium tabular">
                  <Link href={`/employees/${employee.code}`} className="text-primary hover:underline">
                    {employee.code}
                  </Link>
                </Td>
                <Td className="min-w-52 font-medium">
                  {`${employee.titleLo ?? ""} ${employee.fullnameLo}`.trim()}
                </Td>
                <Td>{employee.nickname ?? "-"}</Td>
                <Td className="min-w-44">{labelFor(posName, employee.positionCode)}</Td>
                <Td className="min-w-40">{labelFor(divName, employee.divisionCode)}</Td>
                <Td className="min-w-52">
                  <span>{labelFor(deptName, employee.departmentCode)}</span>
                  {employee.unitCode && (
                    <span className="mt-0.5 block text-xs text-muted">
                      {labelFor(unitName, employee.unitCode)}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap tabular">{employee.mobile ?? "-"}</Td>
                <Td>
                  {hrStatus ? (
                    <Badge tone={HR_STATUS_TONE[hrStatus]}>{HR_STATUS_LABEL[hrStatus]}</Badge>
                  ) : (
                    <Badge>ຍັງບໍ່ມີ Profile</Badge>
                  )}
                </Td>
                <Td>
                  <Badge tone={employmentStatus === "ACTIVE" ? "green" : "gray"}>
                    {EMPLOYMENT_STATUS_LABEL[employmentStatus] ?? employmentStatus}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <Link href={`/employees/${employee.code}`} className="text-sm font-medium text-primary hover:underline">
                    ເບິ່ງ
                  </Link>
                  {canEdit && (
                    <Link href={`/employees/${employee.code}/edit`} className="ml-3 text-sm font-medium text-muted hover:text-primary hover:underline">
                      ແກ້ໄຂ
                    </Link>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} ຈາກ {total}
          </span>
          <div className="flex items-center gap-1">
            <PageBtn href={pageHref(page - 1)} disabled={page <= 1}>
              ‹ ກ່ອນ
            </PageBtn>
            {windowStart > 1 && (
              <>
                <PageBtn href={pageHref(1)}>1</PageBtn>
                {windowStart > 2 && <span className="px-1 text-muted">…</span>}
              </>
            )}
            {pageNumbers.map((p) => (
              <PageBtn key={p} href={pageHref(p)} active={p === page}>
                {p}
              </PageBtn>
            ))}
            {windowEnd < totalPages && (
              <>
                {windowEnd < totalPages - 1 && <span className="px-1 text-muted">…</span>}
                <PageBtn href={pageHref(totalPages)}>{totalPages}</PageBtn>
              </>
            )}
            <PageBtn href={pageHref(page + 1)} disabled={page >= totalPages}>
              ຖັດໄປ ›
            </PageBtn>
          </div>
        </nav>
      )}
    </>
  );
}

function PageBtn({
  href,
  children,
  active = false,
  disabled = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  const base = "min-w-9 rounded-md border px-3 py-1.5 text-center transition";
  if (disabled) {
    return (
      <span className={`${base} border-border text-slate-300`}>{children}</span>
    );
  }
  if (active) {
    return (
      <span className={`${base} border-primary bg-primary font-medium text-white`}>{children}</span>
    );
  }
  return (
    <Link href={href} className={`${base} border-border text-slate-600 hover:bg-slate-50`}>
      {children}
    </Link>
  );
}

export const dynamic = "force-dynamic";
