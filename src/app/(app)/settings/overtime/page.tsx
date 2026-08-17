import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getOvertimeRatePolicy } from "@/lib/overtime-settings";
import { Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { laoDateTime } from "@/lib/format";
import { OvertimeRatePolicyForm } from "../settings-forms";

function historyLabel(detail: string | null): string {
  if (!detail) return "-";
  try {
    const value = JSON.parse(detail) as {
      oldRates: { workdayRate: number; dayOffRate: number; holidayRate: number };
      newRates: { workdayRate: number; dayOffRate: number; holidayRate: number };
    };
    return `ປົກກະຕິ ${value.oldRates.workdayRate}× → ${value.newRates.workdayRate}× · ວັນພັກ ${value.oldRates.dayOffRate}× → ${value.newRates.dayOffRate}× · ວັນບຸນ ${value.oldRates.holidayRate}× → ${value.newRates.holidayRate}×`;
  } catch {
    return detail;
  }
}

export default async function OvertimeSettingsPage() {
  await requireRole("ADMIN", "HR");
  const [rates, history, users] = await Promise.all([
    getOvertimeRatePolicy(),
    prisma.auditLog.findMany({
      where: { entityType: "OvertimeRatePolicy", entityId: "overtime-rates" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      select: { id: true, username: true, employee: { select: { fullnameLo: true } } },
    }),
  ]);
  const userName = new Map(users.map((user) => [user.id, user.employee?.fullnameLo ?? user.username]));

  return <>
    <PageHeader title="ຕັ້ງຄ່າອັດຕາ OT" subtitle="ກຳນົດອັດຕາຈ່າຍຕາມປະເພດວັນ; ຄຳຂໍເກົ່າຈະຄົງອັດຕາເດີມ" />
    <Card>
      <OvertimeRatePolicyForm {...rates} />
    </Card>
    <Card>
      <h2 className="mb-3 font-semibold">ປະຫວັດການປ່ຽນອັດຕາ</h2>
      <Table>
        <thead><tr><Th>ວັນທີ–ເວລາ</Th><Th>ການປ່ຽນແປງ</Th><Th>ຜູ້ປ່ຽນ</Th></tr></thead>
        <tbody>
          {history.length === 0 && <EmptyRow colSpan={3} text="ຍັງບໍ່ມີປະຫວັດ" />}
          {history.map((item) => <tr key={item.id}>
            <Td className="whitespace-nowrap">{laoDateTime(item.createdAt)}</Td>
            <Td>{historyLabel(item.detail)}</Td>
            <Td>{item.userId ? (userName.get(item.userId) ?? item.userId) : "ລະບົບ"}</Td>
          </tr>)}
        </tbody>
      </Table>
    </Card>
  </>;
}

export const dynamic = "force-dynamic";
