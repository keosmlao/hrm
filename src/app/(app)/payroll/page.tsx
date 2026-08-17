import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { kip, MONTH_LAO } from "@/lib/format";
import { PeriodForm } from "./period-form";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "gray" | "amber" | "blue" | "green"> = {
  DRAFT: "gray",
  CALCULATED: "amber",
  APPROVED: "blue",
  PAID: "green",
  CLOSED: "gray",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ຮ່າງ",
  CALCULATED: "ຄິດໄລ່ແລ້ວ",
  APPROVED: "ອະນຸມັດແລ້ວ",
  PAID: "ຈ່າຍແລ້ວ",
  CLOSED: "ປິດຮອບ",
};

export default async function PayrollPage() {
  await requireRole("ADMIN", "HR", "EXECUTIVE");

  const periods = await prisma.payrollPeriod.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { payslips: true } } },
  });
  const totals = await prisma.payslip.groupBy({
    by: ["periodId"],
    _sum: { netPay: true },
  });
  const netByPeriod = new Map(totals.map((t) => [t.periodId, Number(t._sum.netPay ?? 0)]));

  const now = new Date();

  return (
    <>
      <PageHeader title="ເງິນເດືອນ" subtitle="ຮອບຈ່າຍເງິນເດືອນ ແລະ ສະລິບ" />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">ສ້າງຮອບໃໝ່</h2>
        <PeriodForm year={now.getUTCFullYear()} month={now.getUTCMonth() + 1} />
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>ຮອບ</Th>
            <Th className="text-center">ພະນັກງານ</Th>
            <Th className="text-right">ລວມ net</Th>
            <Th>ສະຖານະ</Th>
          </tr>
        </thead>
        <tbody>
          {periods.length === 0 && <EmptyRow colSpan={4} text="ຍັງບໍ່ມີຮອບ" />}
          {periods.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/payroll/${p.id}`} className="text-primary hover:underline">
                  {MONTH_LAO[p.month - 1]} {p.year}
                </Link>
              </Td>
              <Td className="text-center tabular">{p._count.payslips}</Td>
              <Td className="text-right tabular">{kip(netByPeriod.get(p.id) ?? 0)}</Td>
              <Td>
                <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
