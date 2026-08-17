import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole, canViewAllEmployees } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyRow,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { kip, laoDate } from "@/lib/format";
import {
  CONTRACT_TYPE_LABEL,
  GENDER_LABEL,
  HR_STATUS_LABEL,
  HR_STATUS_TONE,
  MARITAL_LABEL,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/labels";
import { ContractForm, EmployeeDocumentForm } from "../employee-record-forms";
import { ResignPanel } from "./resign-panel";
import { deleteEmployeeDocument, setContractActive, assignShift, pendingBeforeResign } from "../actions";
import { DEFAULT_OFFICE_SHIFT_NAME } from "@/lib/hrm-settings";
import { fmtMinutes } from "@/lib/attendance";
import { Combobox } from "@/components/combobox";

function laoTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("lo-LA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Vientiane",
  }).format(d);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value || "-"}</span>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await requireUser();
  const { code } = await params;
  const today = new Date();

  if (!canViewAllEmployees(session) && session.employeeCode !== code) {
    const reportingLine =
      session.role === "MANAGER"
        ? await prisma.employeeProfile.findUnique({
            where: { employeeCode: code },
            select: { managerCode: true },
          })
        : null;
    if (reportingLine?.managerCode !== session.employeeCode) notFound();
  }

  const employee = await prisma.employee.findUnique({
    where: { code },
    include: {
      profile: { include: { manager: true } },
      contracts: { orderBy: { startDate: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      shiftAssignments: {
        where: {
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        include: { shift: true },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
      movements: { orderBy: { effectiveDate: "desc" }, take: 10 },
      assetAssignments: { where: { returnedDate: null } },
    },
  });

  if (!employee) notFound();

  // ຊັບສິນຢູ່ SML (`as_asset`) ບໍ່ມີ relation ໃນ Prisma — ດຶງຊື່ມາຈັບຄູ່ດ້ວຍລະຫັດ
  const assetNames = new Map(
    (
      await prisma.smlAsset.findMany({
        where: { code: { in: employee.assetAssignments.map((a) => a.assetCode) } },
        select: { code: true, name: true },
      })
    ).map((a) => [a.code, a.name ?? a.code]),
  );

  const [department, position, unit, division] = await Promise.all([
    employee.departmentCode
      ? prisma.department.findUnique({ where: { code: employee.departmentCode } })
      : null,
    employee.positionCode
      ? prisma.position.findUnique({ where: { code: employee.positionCode } })
      : null,
    employee.unitCode ? prisma.unit.findUnique({ where: { code: employee.unitCode } }) : null,
    employee.divisionCode
      ? prisma.division.findUnique({ where: { code: employee.divisionCode } })
      : null,
  ]);

  const fetched = await Promise.all([
    prisma.workShift
      .findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, name: true, startTime: true, endTime: true, lateGraceMinutes: true },
      })
      .catch(() => []),
    prisma.attendance
      .findMany({
        where: { employeeCode: code },
        orderBy: { workDate: "desc" },
        take: 14,
        select: {
          workDate: true,
          checkInAt: true,
          checkOutAt: true,
          lateMinutes: true,
          workedMinutes: true,
        },
      })
      .catch(() => []),
    prisma.employeeShiftAssignment
      .findMany({
        where: { employeeCode: code },
        include: {
          shift: {
            select: { name: true, startTime: true, endTime: true, lateGraceMinutes: true },
          },
        },
        orderBy: { effectiveFrom: "desc" },
      })
      .catch(() => []),
  ]);
  const [shifts, recentAttendance, shiftHistory] = fetched;

  const p = employee.profile;
  const currentShift = employee.shiftAssignments[0]?.shift;
  const canEdit = hasRole(session, "ADMIN", "HR");
  // ວຽກຄ້າງ — ໃຫ້ HR ເຫັນກ່ອນຢືນຢັນລາອອກ
  const pending = canEdit ? await pendingBeforeResign(code) : { assets: 0, trips: 0, leaves: 0, ots: 0, corrections: 0, isApprover: false };
  const canSeeSalary =
    hasRole(session, "ADMIN", "HR", "EXECUTIVE") || session.employeeCode === code;

  return (
    <>
      <PageHeader
        title={`${employee.titleLo ?? ""} ${employee.fullnameLo}`.trim()}
        subtitle={[position?.nameLo, department?.nameLo, unit?.nameLo]
          .filter(Boolean)
          .join(" · ")}
        action={
          canEdit ? (
            <LinkButton href={`/employees/${code}/edit`} variant="ghost">
              ແກ້ໄຂຂໍ້ມູນ
            </LinkButton>
          ) : null
        }
      />

      {canEdit && (
        <div className="mb-6">
          <ResignPanel
            code={code}
            name={employee.fullnameLo}
            hrStatus={p?.hrStatus ?? null}
            resignDate={p?.resignDate ? laoDate(p.resignDate) : null}
            pending={pending}
            today={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" })}
          />
        </div>
      )}

      {!p && canEdit && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ພະນັກງານຄົນນີ້ຍັງບໍ່ມີຂໍ້ມູນ HR (ເງິນເດືອນ, ຫົວໜ້າ, ສະຖານະ) — ກົດ “ແກ້ໄຂຂໍ້ມູນ” ເພື່ອເພີ່ມ
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">ຂໍ້ມູນສ່ວນຕົວ</h2>
          <Row label="ລະຫັດພະນັກງານ" value={employee.code} />
          <Row label="ຊື່ (ອັງກິດ)" value={employee.fullnameEn} />
          <Row label="ຊື່ຫຼິ້ນ" value={employee.nickname} />
          <Row label="ເພດ" value={p?.gender ? GENDER_LABEL[p.gender] : null} />
          <Row label="ວັນເກີດ" value={p?.dob ? laoDate(p.dob) : null} />
          <Row
            label="ສະຖານະການແຕ່ງງານ"
            value={p?.maritalStatus ? MARITAL_LABEL[p.maritalStatus] : null}
          />
          <Row label="ເບີໂທ" value={employee.mobile} />
          <Row label="ອີເມວ" value={p?.email} />
          <Row label="ທີ່ຢູ່" value={p?.address} />
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">ຂໍ້ມູນການເຮັດວຽກ</h2>
          <Row
            label="ສະຖານະ"
            value={
              p ? (
                <Badge tone={HR_STATUS_TONE[p.hrStatus]}>{HR_STATUS_LABEL[p.hrStatus]}</Badge>
              ) : null
            }
          />
          <Row label="ຝ່າຍ" value={division?.nameLo} />
          <Row label="ພະແນກ" value={department?.nameLo} />
          <Row label="ໜ່ວຍງານ" value={unit?.nameLo} />
          <Row label="ຕຳແໜ່ງ" value={position?.nameLo} />
          <Row
            label="ກະເຮັດວຽກ"
            value={
              currentShift
                ? `${currentShift.name} (${currentShift.startTime}–${currentShift.endTime} · ຊ້າ ${currentShift.lateGraceMinutes}ນທ)`
                : `${DEFAULT_OFFICE_SHIFT_NAME} (08:00–17:00)`
            }
          />
          {canEdit && (
            <form
              action={assignShift.bind(null, code)}
              className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-3"
            >
              <label className="text-xs text-muted">
                <span className="mb-1 block">ປ່ຽນກະ</span>
                <Combobox
                  name="shiftId"
                  defaultValue={currentShift?.id ?? ""}
                  className="w-64"
                  options={[
                    { value: "", label: "ຄ່າເລີ່ມຕົ້ນ (08:00–17:00)" },
                    ...shifts.map((s) => ({
                      value: s.id,
                      label: `${s.name} · ${s.startTime}–${s.endTime} · ຊ້າ ${s.lateGraceMinutes}ນທ`,
                    })),
                  ]}
                />
              </label>
              <label className="text-xs text-muted">
                <span className="mb-1 block">ຕັ້ງແຕ່ວັນທີ</span>
                <input
                  type="date"
                  name="effectiveFrom"
                  className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted">
                <span className="mb-1 block">ໝາຍເຫດ</span>
                <input
                  name="note"
                  placeholder="ເຫດຜົນ (ຖ້າມີ)"
                  className="w-40 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:brightness-110">
                ບັນທຶກກະ
              </button>
            </form>
          )}
          <Row
            label="ຫົວໜ້າໂດຍກົງ"
            value={
              p?.manager ? (
                <Link
                  href={`/employees/${p.manager.code}`}
                  className="text-primary hover:underline"
                >
                  {p.manager.fullnameLo}
                </Link>
              ) : null
            }
          />
          <Row label="ວັນເລີ່ມວຽກ" value={laoDate(employee.hireDate)} />
          <Row
            label="ຄົບທົດລອງງານ"
            value={p?.probationEndDate ? laoDate(p.probationEndDate) : null}
          />
        </Card>

        {canSeeSalary && (
          <Card>
            <h2 className="mb-3 font-semibold">ເງິນເດືອນ ແລະ ທະນາຄານ</h2>
            <Row label="ເງິນເດືອນພື້ນຖານ" value={p ? kip(Number(p.baseSalary)) : null} />
            <Row label="ຄ່າຕຳແໜ່ງ" value={p ? kip(Number(p.positionAllowance)) : null} />
            <Row
              label="ລວມຕໍ່ເດືອນ"
              value={p ? kip(Number(p.baseSalary) + Number(p.positionAllowance)) : null}
            />
            <Row label="ທະນາຄານ" value={p?.bankName} />
            <Row label="ເລກບັນຊີ" value={p?.bankAccountNo} />
            <Row label="ເລກປະກັນສັງຄົມ" value={p?.socialSecurityNo} />
          </Card>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-semibold">ປະຫວັດການປ່ຽນກະ</h2>
        <Table>
          <thead>
            <tr>
              <Th>ກະ</Th>
              <Th>ຕັ້ງແຕ່</Th>
              <Th>ຮອດ</Th>
              <Th>ໝາຍເຫດ</Th>
            </tr>
          </thead>
          <tbody>
            {shiftHistory.length === 0 && (
              <EmptyRow colSpan={4} text="ໃຊ້ຄ່າເລີ່ມຕົ້ນ (ບໍ່ເຄີຍປ່ຽນກະ)" />
            )}
            {shiftHistory.map((h) => (
              <tr key={h.id}>
                <Td>
                  {h.shift.name}{" "}
                  <span className="text-xs text-muted">
                    ({h.shift.startTime}–{h.shift.endTime} · ຊ້າ {h.shift.lateGraceMinutes}ນທ)
                  </span>
                </Td>
                <Td className="tabular">{laoDate(h.effectiveFrom)}</Td>
                <Td>
                  {h.effectiveTo ? (
                    <span className="tabular">{laoDate(h.effectiveTo)}</span>
                  ) : (
                    <Badge tone="green">ປັດຈຸບັນ</Badge>
                  )}
                </Td>
                <Td className="text-xs text-muted">{h.note ?? "-"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-semibold">ການລົງເວລາ (14 ຄັ້ງຫຼ້າສຸດ)</h2>
        <Table>
          <thead>
            <tr>
              <Th>ວັນທີ</Th>
              <Th>ເຂົ້າ</Th>
              <Th>ອອກ</Th>
              <Th className="text-center">ຊ້າ</Th>
              <Th className="text-right">ຊົ່ວໂມງ</Th>
            </tr>
          </thead>
          <tbody>
            {recentAttendance.length === 0 && (
              <EmptyRow colSpan={5} text="ຍັງບໍ່ມີການລົງເວລາ" />
            )}
            {recentAttendance.map((a) => (
              <tr key={a.workDate.toISOString()}>
                <Td>{laoDate(a.workDate)}</Td>
                <Td className="tabular">{laoTime(a.checkInAt)}</Td>
                <Td className="tabular">{laoTime(a.checkOutAt)}</Td>
                <Td className="text-center">
                  {a.lateMinutes > 0 ? <Badge tone="amber">{a.lateMinutes} ນທ</Badge> : "-"}
                </Td>
                <Td className="text-right tabular">{fmtMinutes(a.workedMinutes)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">ສັນຍາຈ້າງ</h2>
            {canEdit && <details className="relative"><summary className="cursor-pointer list-none text-xs font-medium text-primary">+ ເພີ່ມສັນຍາ</summary><div className="absolute right-0 z-20 mt-2 w-[min(38rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-xl"><ContractForm employeeCode={code} /></div></details>}
          </div>
          <Table>
            <thead>
              <tr>
                <Th>ເລກສັນຍາ</Th>
                <Th>ປະເພດ</Th>
                <Th>ໄລຍະ</Th>
                <Th>ເງິນເດືອນ</Th>
                <Th>ສະຖານະ</Th>
              </tr>
            </thead>
            <tbody>
              {employee.contracts.length === 0 && <EmptyRow colSpan={5} />}
              {employee.contracts.map((c) => (
                <tr key={c.id}>
                  <Td>{c.contractNo}</Td>
                  <Td>{CONTRACT_TYPE_LABEL[c.type]}</Td>
                  <Td className="text-xs">
                    {laoDate(c.startDate)} — {c.endDate ? laoDate(c.endDate) : "ບໍ່ກຳນົດ"}
                  </Td>
                  <Td>{canSeeSalary ? kip(Number(c.salary)) : "***"}</Td>
                  <Td>
                    {canEdit ? <form action={setContractActive.bind(null, c.id, !c.isActive)}><button className={`text-xs hover:underline ${c.isActive ? "text-emerald-700" : "text-muted"}`}>{c.isActive ? "ເປີດໃຊ້ · ກົດເພື່ອປິດ" : "ປິດແລ້ວ · ກົດເພື່ອເປີດ"}</button></form> : <Badge tone={c.isActive ? "green" : "gray"}>{c.isActive ? "ເປີດໃຊ້" : "ປິດ"}</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">ປະຫວັດການປ່ຽນແປງ</h2>
          <Table>
            <thead>
              <tr>
                <Th>ວັນທີ</Th>
                <Th>ປະເພດ</Th>
                <Th>ລາຍລະອຽດ</Th>
              </tr>
            </thead>
            <tbody>
              {employee.movements.length === 0 && <EmptyRow colSpan={3} />}
              {employee.movements.map((m) => (
                <tr key={m.id}>
                  <Td>{laoDate(m.effectiveDate)}</Td>
                  <Td>
                    <Badge tone="blue">{MOVEMENT_TYPE_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className="text-xs text-muted">
                    {m.type === "SALARY_ADJUST" && canSeeSalary
                      ? `${kip(Number(m.fromSalary))} → ${kip(Number(m.toSalary))}`
                      : (m.reason ?? "-")}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">ເອກະສານ</h2>
            {canEdit && <details className="relative"><summary className="cursor-pointer list-none text-xs font-medium text-primary">+ ເພີ່ມເອກະສານ</summary><div className="absolute right-0 z-20 mt-2 w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-xl"><EmployeeDocumentForm employeeCode={code} /></div></details>}
          </div>
          <Table>
            <thead><tr><Th>ເອກະສານ</Th><Th>ປະເພດ</Th><Th>ໝົດອາຍຸ</Th><Th></Th></tr></thead>
            <tbody>
              {employee.documents.length === 0 && <EmptyRow colSpan={4} />}
              {employee.documents.map((document) => (
                <tr key={document.id}>
                  <Td><a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{document.name} ↗</a></Td>
                  <Td>{document.type ?? "-"}</Td>
                  <Td>{document.expiryDate ? laoDate(document.expiryDate) : "-"}</Td>
                  <Td>{canEdit && <form action={deleteEmployeeDocument.bind(null, document.id)}><button className="text-xs text-rose-600 hover:underline">ລຶບ</button></form>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">ຊັບສິນທີ່ຖືຄອງ</h2>
          <Table>
            <thead>
              <tr>
                <Th>ຊັບສິນ</Th>
                <Th>ລະຫັດ</Th>
                <Th>ວັນທີມອບ</Th>
              </tr>
            </thead>
            <tbody>
              {employee.assetAssignments.length === 0 && <EmptyRow colSpan={3} />}
              {employee.assetAssignments.map((a) => (
                <tr key={a.id}>
                  <Td>{assetNames.get(a.assetCode) ?? "—"}</Td>
                  <Td className="tabular">{a.assetCode}</Td>
                  <Td>{laoDate(a.assignedDate)}</Td>
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
