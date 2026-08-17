import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { laoDate } from "@/lib/format";
import { NewHolidayForm } from "../settings-forms";
import { deleteHoliday } from "../actions";

export default async function HolidaySettingsPage() {
  await requireRole("ADMIN", "HR");
  const holidays = await prisma.publicHoliday.findMany({
    orderBy: { date: "asc" },
    take: 300,
  });

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າວັນພັກ"
        subtitle="ປະຕິທິນວັນພັກບໍລິສັດ ແລະວັນພັກປະຈຳປີ"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມວັນພັກ</h2>
        <NewHolidayForm />
      </Card>

      <h2 className="mb-3 font-semibold">ປະຕິທິນວັນພັກ ({holidays.length})</h2>
      <Table>
        <thead><tr><Th>ວັນທີ</Th><Th>ຊື່ວັນພັກ</Th><Th></Th></tr></thead>
        <tbody>
          {holidays.length === 0 && <EmptyRow colSpan={3} />}
          {holidays.map((holiday) => (
            <tr key={holiday.id}>
              <Td>{laoDate(holiday.date)}</Td>
              <Td>{holiday.name}</Td>
              <Td>
                <form action={deleteHoliday.bind(null, holiday.id)}>
                  <button className="text-xs text-rose-600 hover:underline">ລຶບ</button>
                </form>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export const dynamic = "force-dynamic";
