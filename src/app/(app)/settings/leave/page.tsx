import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { NewLeaveTypeForm } from "../settings-forms";
import { updateLeaveType } from "../actions";

export default async function LeaveSettingsPage() {
  await requireRole("ADMIN", "HR");
  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { code: "asc" } });

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າການລາ"
        subtitle="ປະເພດການລາ, ຈຳນວນວັນຕໍ່ປີ, ການຮັບເງິນ ແລະຫຼັກຖານ"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມປະເພດການລາ</h2>
        <NewLeaveTypeForm />
      </Card>

      <h2 className="mb-3 font-semibold">ປະເພດການລາ ({leaveTypes.length})</h2>
      <Table>
        <thead><tr><Th>ລະຫັດ</Th><Th>ຊື່</Th><Th>ວັນ / ປີ</Th><Th>ຮັບເງິນ</Th><Th>ຫຼັກຖານ</Th><Th>ເປີດໃຊ້</Th><Th></Th></tr></thead>
        <tbody>
          {leaveTypes.length === 0 && <EmptyRow colSpan={7} />}
          {leaveTypes.map((type) => (
            <tr key={type.id}>
              <Td className="font-medium">{type.code}</Td>
              <Td colSpan={6}>
                <form action={updateLeaveType.bind(null, type.id)} className="grid min-w-[680px] grid-cols-[2fr_90px_90px_90px_90px_80px] items-center gap-3">
                  <input name="name" defaultValue={type.name} required className={inputClass} />
                  <input name="daysPerYear" type="number" min="0" max="366" defaultValue={type.daysPerYear} className={inputClass} />
                  <label className="text-center"><input name="isPaid" type="checkbox" defaultChecked={type.isPaid} /></label>
                  <label className="text-center"><input name="requiresProof" type="checkbox" defaultChecked={type.requiresProof} /></label>
                  <label className="text-center"><input name="isActive" type="checkbox" defaultChecked={type.isActive} /></label>
                  <button className="text-xs font-medium text-primary hover:underline">ບັນທຶກ</button>
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
