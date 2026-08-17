import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { kip, MONTH_LAO } from "@/lib/format";
import { generatePayslips, setPeriodStatus, deletePeriod } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ຮ່າງ",
  CALCULATED: "ຄິດໄລ່ແລ້ວ",
  APPROVED: "ອະນຸມັດແລ້ວ",
  PAID: "ຈ່າຍແລ້ວ",
  CLOSED: "ປິດຮອບ",
};

export default async function PeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN", "HR", "EXECUTIVE");
  const { id } = await params;

  const period = await prisma.payrollPeriod.findUnique({
    where: { id },
    include: {
      payslips: {
        include: { employee: { select: { fullnameLo: true, titleLo: true } } },
        orderBy: { employeeCode: "asc" },
      },
    },
  });
  if (!period) notFound();

  const totals = period.payslips.reduce(
    (a, p) => ({
      gross: a.gross + Number(p.grossPay),
      ded: a.ded + Number(p.totalDeduction),
      net: a.net + Number(p.netPay),
    }),
    { gross: 0, ded: 0, net: 0 },
  );

  const editable = period.status !== "PAID" && period.status !== "CLOSED";

  return (
    <>
      <PageHeader
        title={`ເງິນເດືອນ ${MONTH_LAO[period.month - 1]} ${period.year}`}
        subtitle={`ສະຖານະ: ${STATUS_LABEL[period.status]} · ${period.payslips.length} ສະລິບ`}
        action={
          <Link href="/payroll" className="text-sm text-primary hover:underline">
            ← ກັບໄປຮອບທັງໝົດ
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {editable && (
          <form action={generatePayslips.bind(null, period.id)}>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-110">
              {period.payslips.length ? "ຄິດໄລ່ໃໝ່" : "ຄິດໄລ່ສະລິບ"}
            </button>
          </form>
        )}
        {period.status === "CALCULATED" && (
          <form action={setPeriodStatus.bind(null, period.id, "APPROVED")}>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110">
              ອະນຸມັດ
            </button>
          </form>
        )}
        {period.status === "APPROVED" && (
          <form action={setPeriodStatus.bind(null, period.id, "PAID")}>
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110">
              ໝາຍວ່າຈ່າຍແລ້ວ
            </button>
          </form>
        )}
        {editable && period.payslips.length === 0 && (
          <form action={deletePeriod.bind(null, period.id)}>
            <button className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50">
              ລຶບຮອບ
            </button>
          </form>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="ລວມ gross" value={kip(totals.gross)} />
        <StatCard label="ລວມຫັກ" value={kip(totals.ded)} />
        <StatCard label="ລວມຈ່າຍ (net)" value={kip(totals.net)} tone="good" />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ພະນັກງານ</Th>
            <Th className="text-right">ພື້ນຖານ</Th>
            <Th className="text-right">OT</Th>
            <Th className="text-right">ປະກັນ+ພາສີ</Th>
            <Th className="text-right">ຫັກອື່ນ</Th>
            <Th className="text-right">Net</Th>
          </tr>
        </thead>
        <tbody>
          {period.payslips.length === 0 && (
            <EmptyRow colSpan={6} text="ຍັງບໍ່ໄດ້ຄິດໄລ່ — ກົດ “ຄິດໄລ່ສະລິບ”" />
          )}
          {period.payslips.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/payroll/slip/${p.id}`} className="text-primary hover:underline">
                  {p.employee.titleLo} {p.employee.fullnameLo}
                </Link>
              </Td>
              <Td className="text-right tabular">{kip(Number(p.baseSalary) + Number(p.positionAllowance))}</Td>
              <Td className="text-right tabular">{kip(Number(p.otAmount))}</Td>
              <Td className="text-right tabular">
                {kip(Number(p.socialSecurity) + Number(p.incomeTax))}
              </Td>
              <Td className="text-right tabular">
                {kip(Number(p.otherDeductions) + Number(p.lateDeduction) + Number(p.absentDeduction))}
              </Td>
              <Td className="text-right tabular font-medium">{kip(Number(p.netPay))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <p className="mt-3 text-xs text-muted">
        ປະກັນສັງຄົມ 5.5% ຂອງເງິນເດືອນພື້ນຖານ (ເພດານ) · ພາສີລາຍໄດ້ຄິດແບບຂັ້ນໄດ (PIT) · ຄ່າຕັ້ງໃນ .env
      </p>
    </>
  );
}
