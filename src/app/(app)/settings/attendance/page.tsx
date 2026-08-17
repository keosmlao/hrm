import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getAttendanceCyclePolicy, getAttendanceLocationPolicy } from "@/lib/hrm-settings";
import { Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { laoDateTime } from "@/lib/format";
import { AttendanceCyclePolicyForm, AttendanceLocationPolicyForm } from "../settings-forms";

function cycleChangeLabel(detail: string | null): string {
  if (!detail) return "-";
  try {
    const value = JSON.parse(detail) as {
      oldStartDay: number;
      oldEndDay: number;
      newStartDay: number;
      newEndDay: number;
    };
    return `ວັນທີ ${value.oldStartDay}–${value.oldEndDay} → ວັນທີ ${value.newStartDay}–${value.newEndDay}`;
  } catch {
    return detail;
  }
}

export default async function AttendanceSettingsPage() {
  await requireRole("ADMIN", "HR");
  const [cyclePolicy, locationPolicy, cycleHistory, users] = await Promise.all([
    getAttendanceCyclePolicy(),
    getAttendanceLocationPolicy(),
    prisma.auditLog.findMany({
      where: { entityType: "AttendanceCyclePolicy", entityId: "attendance-cycle" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      select: { id: true, username: true, employee: { select: { fullnameLo: true } } },
    }),
  ]);
  const userName = new Map(
    users.map((user) => [user.id, user.employee?.fullnameLo ?? user.username]),
  );

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າການລົງເວລາ"
        subtitle="ຮອບສະຫຼຸບການລົງເວລາປະຈຳເດືອນ"
      />

      <Card>
        <h2 className="mb-1 font-semibold">ຮອບສະຫຼຸບການລົງເວລາ</h2>
        <p className="mb-4 text-xs text-muted">
          ກຳນົດວັນປິດຮອບ; ວັນເລີ່ມຮອບຈະເປັນມື້ຖັດໄປໂດຍອັດຕະໂນມັດ
        </p>
        <AttendanceCyclePolicyForm endDay={cyclePolicy.endDay} />

        <h3 className="mb-3 mt-6 text-sm font-semibold">ປະຫວັດການປ່ຽນຮອບ</h3>
        <Table>
          <thead><tr><Th>ວັນທີ–ເວລາ</Th><Th>ການປ່ຽນແປງ</Th><Th>ຜູ້ປ່ຽນ</Th></tr></thead>
          <tbody>
            {cycleHistory.length === 0 && <EmptyRow colSpan={3} text="ຍັງບໍ່ມີປະຫວັດການປ່ຽນຮອບ" />}
            {cycleHistory.map((history) => (
              <tr key={history.id}>
                <Td className="whitespace-nowrap">{laoDateTime(history.createdAt)}</Td>
                <Td className="font-medium">{cycleChangeLabel(history.detail)}</Td>
                <Td>{history.userId ? (userName.get(history.userId) ?? history.userId) : "ລະບົບ"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">ພື້ນທີ່ອະນຸຍາດໃຫ້ລົງເວລາ</h2>
        <p className="mb-4 text-xs text-muted">ຖ້າເປີດໃຊ້ ພະນັກງານຕ້ອງເປີດ GPS ແລະຢູ່ໃນລັດສະໝີທີ່ກຳນົດ</p>
        <AttendanceLocationPolicyForm {...locationPolicy} />
      </Card>
    </>
  );
}

export const dynamic = "force-dynamic";
