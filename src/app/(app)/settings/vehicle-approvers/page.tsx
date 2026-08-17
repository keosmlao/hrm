import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { VehicleApproverForm } from "./approver-form";
import { removeVehicleApprover } from "./actions";

export const dynamic = "force-dynamic";

export default async function VehicleApproversPage() {
  await requireRole("ADMIN", "HR");
  const [approvers, employees] = await Promise.all([
    prisma.vehicleApprover.findMany({ include: { employee: { select: { fullnameLo: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.employee.findMany({ where: { employmentStatus: "ACTIVE" }, select: { code: true, fullnameLo: true }, orderBy: { code: "asc" } }),
  ]);
  const options = employees.map((e) => ({ value: e.code, label: `${e.code} · ${e.fullnameLo}` }));

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າຜູ້ອະນຸມັດລົດ"
        subtitle="ຄົນໃນລາຍການນີ້ ອະນຸມັດ 'ການໃຊ້ລົດ' ຂອງທຸກກຸ່ມໄດ້ · ADMIN/HR ອະນຸມັດໄດ້ຢູ່ແລ້ວ · ແຍກຈາກການອະນຸມັດ 'ແຜນ'"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມຜູ້ອະນຸມັດລົດ</h2>
        <VehicleApproverForm employees={options} />
      </Card>

      <h2 className="mb-3 font-semibold">ຜູ້ອະນຸມັດລົດ ({approvers.length})</h2>
      <Table>
        <thead>
          <tr>
            <Th>ພະນັກງານ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {approvers.length === 0 && <EmptyRow colSpan={2} text="ຍັງບໍ່ມີ — ມີແຕ່ ADMIN/HR ອະນຸມັດລົດ" />}
          {approvers.map((a) => (
            <tr key={a.employeeCode}>
              <Td>{a.employeeCode} · {a.employee.fullnameLo}</Td>
              <Td>
                <form action={removeVehicleApprover.bind(null, a.employeeCode)}>
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
