import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { kip, MONTH_LAO } from "@/lib/format";

export const dynamic = "force-dynamic";

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1.5 text-sm ${bold ? "border-t border-border font-semibold" : ""}`}
    >
      <span className={bold ? "" : "text-muted"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

export default async function SlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;

  const slip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      employee: { select: { code: true, titleLo: true, fullnameLo: true } },
      period: true,
      items: true,
    },
  });
  if (!slip) notFound();

  // ເຈົ້າຂອງ ຫຼື HR/ADMIN/EXECUTIVE ເທົ່ານັ້ນ
  const isOwner = session.employeeCode === slip.employeeCode;
  if (!isOwner && !hasRole(session, "ADMIN", "HR", "EXECUTIVE")) redirect("/dashboard");

  const n = (d: unknown) => Number(d);

  return (
    <>
      <PageHeader
        title="ສະລິບເງິນເດືອນ"
        subtitle={`${slip.employee.titleLo ?? ""} ${slip.employee.fullnameLo} · ${MONTH_LAO[slip.period.month - 1]} ${slip.period.year}`}
        action={
          hasRole(session, "ADMIN", "HR", "EXECUTIVE") ? (
            <Link href={`/payroll/${slip.periodId}`} className="text-sm text-primary hover:underline">
              ← ກັບຮອບ
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-emerald-700">ລາຍຮັບ</h2>
          <Line label="ເງິນເດືອນພື້ນຖານ" value={kip(n(slip.baseSalary))} />
          <Line label="ຄ່າຕຳແໜ່ງ" value={kip(n(slip.positionAllowance))} />
          {n(slip.commission) > 0 && <Line label="ຄอมมິຊັນ" value={kip(n(slip.commission))} />}
          {n(slip.otAmount) > 0 && <Line label="ໂອທີ (OT)" value={kip(n(slip.otAmount))} />}
          {n(slip.bonus) > 0 && <Line label="ໂບນັດ" value={kip(n(slip.bonus))} />}
          {n(slip.otherEarnings) > 0 && <Line label="ລາຍຮັບອື່ນ" value={kip(n(slip.otherEarnings))} />}
          <Line label="ລວມລາຍຮັບ (gross)" value={kip(n(slip.grossPay))} bold />
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-rose-700">ລາຍການຫັກ</h2>
          <Line label="ປະກັນສັງຄົມ" value={kip(n(slip.socialSecurity))} />
          <Line label="ພາສີລາຍໄດ້" value={kip(n(slip.incomeTax))} />
          {n(slip.lateDeduction) > 0 && <Line label="ຫັກມາຊ້າ" value={kip(n(slip.lateDeduction))} />}
          {n(slip.absentDeduction) > 0 && <Line label="ຫັກຂາດວຽກ" value={kip(n(slip.absentDeduction))} />}
          {n(slip.otherDeductions) > 0 && <Line label="ຫັກອື່ນໆ" value={kip(n(slip.otherDeductions))} />}
          <Line label="ລວມຫັກ" value={kip(n(slip.totalDeduction))} bold />
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">ຮັບສຸດທິ (net)</span>
          <span className="tabular text-2xl font-bold text-emerald-700">{kip(n(slip.netPay))}</span>
        </div>
        {slip.note && <p className="mt-2 text-xs text-muted">{slip.note}</p>}
      </Card>
    </>
  );
}
