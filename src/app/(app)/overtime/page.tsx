import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { laoDate } from "@/lib/format";
import { REQUEST_STATUS_LABEL } from "@/lib/labels";
import { OvertimeRequestForm } from "./request-form";
import { approveOvertime, cancelOvertime, rejectOvertime } from "./actions";
import { getOvertimeRatePolicy, OVERTIME_RATE_LABEL, type OvertimeRateType } from "@/lib/overtime-settings";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "gray" | "amber" | "green" | "red"> = {
  DRAFT: "gray",
  PENDING_MANAGER: "amber",
  PENDING_HR: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export default async function OvertimePage() {
  const session = await requireUser();
  const isHR = hasRole(session, "ADMIN", "HR");
  const isApprover = isHR || session.role === "MANAGER";

  const [mine, pending, rates] = await Promise.all([
    session.employeeCode
      ? prisma.overtimeRequest.findMany({
          where: { employeeCode: session.employeeCode },
          orderBy: { workDate: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    isApprover
      ? prisma.overtimeRequest.findMany({
          where: isHR
            ? { status: { in: ["PENDING_MANAGER", "PENDING_HR"] } }
            : {
                status: "PENDING_MANAGER",
                employee: { profile: { managerCode: session.employeeCode ?? "" } },
              },
          include: { employee: true },
          orderBy: { workDate: "asc" },
        })
      : Promise.resolve([]),
    getOvertimeRatePolicy(),
  ]);

  return (
    <>
      <PageHeader title="ວຽກລ່ວງເວລາ (OT)" subtitle="ຄຳຂໍ, ການອະນຸມັດ ແລະ ອັດຕາຈ່າຍ" />

      {session.employeeCode && (
        <Card className="mb-7">
          <h2 className="mb-4 font-semibold">ສ້າງຄຳຂໍໃໝ່</h2>
          <OvertimeRequestForm rates={rates} />
        </Card>
      )}

      {isApprover && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">ລໍຖ້າອະນຸມັດ ({pending.length})</h2>
          <Table>
            <thead><tr><Th>ພະນັກງານ</Th><Th>ວັນທີ</Th><Th>ເວລາ</Th><Th>ຊົ່ວໂມງ</Th><Th>ອັດຕາ</Th><Th>ສະຖານະ</Th><Th>ຈັດການ</Th></tr></thead>
            <tbody>
              {pending.length === 0 && <EmptyRow colSpan={7} text="ບໍ່ມີຄຳຂໍລໍຖ້າ" />}
              {pending.map((request) => (
                <tr key={request.id}>
                  <Td>{request.employee.fullnameLo}</Td>
                  <Td>{laoDate(request.workDate)}</Td>
                  <Td className="tabular">{request.startTime}–{request.endTime}</Td>
                  <Td className="tabular">{request.hours}</Td>
                  <Td className="tabular">{request.rate}× <span className="block text-[11px] text-muted">{OVERTIME_RATE_LABEL[request.rateType as OvertimeRateType] ?? request.rateType}</span></Td>
                  <Td><Badge tone={STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge></Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <form action={approveOvertime.bind(null, request.id)}>
                        <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">ອະນຸມັດ</button>
                      </form>
                      <form action={rejectOvertime.bind(null, request.id)} className="flex gap-1">
                        <input name="reason" placeholder="ເຫດຜົນ" className="w-24 rounded-md border border-border px-2 py-1 text-xs" />
                        <button className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white">ປະຕິເສດ</button>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      <h2 className="mb-3 font-semibold">ຄຳຂໍຂອງຂ້ອຍ</h2>
      <Table>
        <thead><tr><Th>ວັນທີ</Th><Th>ເວລາ</Th><Th>ຊົ່ວໂມງ</Th><Th>ອັດຕາ</Th><Th>ເຫດຜົນ</Th><Th>ສະຖານະ</Th><Th></Th></tr></thead>
        <tbody>
          {mine.length === 0 && <EmptyRow colSpan={7} text="ຍັງບໍ່ມີຄຳຂໍ OT" />}
          {mine.map((request) => (
            <tr key={request.id}>
              <Td>{laoDate(request.workDate)}</Td>
              <Td className="tabular">{request.startTime}–{request.endTime}</Td>
              <Td className="tabular">{request.hours}</Td>
              <Td className="tabular">{request.rate}× <span className="block text-[11px] text-muted">{OVERTIME_RATE_LABEL[request.rateType as OvertimeRateType] ?? request.rateType}</span></Td>
              <Td className="text-xs text-muted">{request.status === "REJECTED" ? request.rejectReason : request.reason ?? "-"}</Td>
              <Td><Badge tone={STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge></Td>
              <Td>
                {['DRAFT', 'PENDING_MANAGER', 'PENDING_HR'].includes(request.status) && (
                  <form action={cancelOvertime.bind(null, request.id)}>
                    <button className="text-xs text-rose-600 hover:underline">ຍົກເລີກ</button>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
