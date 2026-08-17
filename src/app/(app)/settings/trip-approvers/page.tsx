import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { APPROVER_TYPE_LABEL } from "@/lib/trip-approvals";
import { ApprovalStepForm } from "./approver-form";
import { removeApprovalStep, moveApprovalStep } from "./actions";

export const dynamic = "force-dynamic";

export default async function TripApproversPage() {
  await requireRole("ADMIN", "HR");
  const [steps, employees] = await Promise.all([
    prisma.tripApprovalStep.findMany({ include: { specificEmployee: { select: { fullnameLo: true } } }, orderBy: { stepOrder: "asc" } }),
    prisma.employee.findMany({ where: { employmentStatus: "ACTIVE" }, select: { code: true, fullnameLo: true }, orderBy: { code: "asc" } }),
  ]);
  const employeeOptions = employees.map((e) => ({ value: e.code, label: `${e.code} · ${e.fullnameLo}` }));

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າຂັ້ນຕອນອະນຸມັດ Trip"
        subtitle="ຄຳຮ້ອງໃຊ້ລົດຂອງພະນັກງານ ຈະຜ່ານແຕ່ລະຂັ້ນຕາມລຳດັບ · ADMIN/HR ຂ້າມຂັ້ນໄດ້ · ຖ້າບໍ່ມີຂັ້ນ = ອະນຸມັດເອງໂດຍ admin"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມຂັ້ນອະນຸມັດ</h2>
        <ApprovalStepForm employees={employeeOptions} />
      </Card>

      <h2 className="mb-3 font-semibold">ຂັ້ນຕອນປັດຈຸບັນ ({steps.length})</h2>
      <Table>
        <thead>
          <tr>
            <Th className="text-center">ຂັ້ນ</Th>
            <Th>ຜູ້ອະນຸມັດ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {steps.length === 0 && <EmptyRow colSpan={3} text="ຍັງບໍ່ມີຂັ້ນອະນຸມັດ (ຄຳຮ້ອງຈະໃຫ້ admin ຈັດການເອງ)" />}
          {steps.map((s, i) => (
            <tr key={s.id}>
              <Td className="text-center tabular font-medium">{i + 1}</Td>
              <Td>
                {APPROVER_TYPE_LABEL[s.approverType] ?? s.approverType}
                {s.approverType === "SPECIFIC" && s.specificEmployee && (
                  <span className="text-muted"> · {s.specificEmployeeCode} · {s.specificEmployee.fullnameLo}</span>
                )}
              </Td>
              <Td>
                <div className="flex items-center gap-3">
                  {i > 0 && <form action={moveApprovalStep.bind(null, s.id, "up")}><button className="text-xs text-primary hover:underline">↑</button></form>}
                  {i < steps.length - 1 && <form action={moveApprovalStep.bind(null, s.id, "down")}><button className="text-xs text-primary hover:underline">↓</button></form>}
                  <form action={removeApprovalStep.bind(null, s.id)}><button className="text-xs text-rose-600 hover:underline">ລຶບ</button></form>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
