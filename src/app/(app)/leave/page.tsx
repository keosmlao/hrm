import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyRow,
  LinkButton,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { laoDate } from "@/lib/format";
import { REQUEST_STATUS_LABEL } from "@/lib/labels";
import { approveLeave, rejectLeave, cancelLeave } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "gray" | "amber" | "green" | "red"> = {
  DRAFT: "gray",
  PENDING_MANAGER: "amber",
  PENDING_HR: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export default async function LeavePage() {
  const session = await requireUser();
  const isApprover = hasRole(session, "ADMIN", "HR") || session.role === "MANAGER";
  const isHR = hasRole(session, "ADMIN", "HR");
  const year = new Date().getUTCFullYear();

  const [balances, myRequests, pending] = await Promise.all([
    session.employeeCode
      ? prisma.leaveBalance.findMany({
          where: { employeeCode: session.employeeCode, year },
          include: { leaveType: true },
          orderBy: { leaveType: { code: "asc" } },
        })
      : Promise.resolve([]),
    session.employeeCode
      ? prisma.leaveRequest.findMany({
          where: { employeeCode: session.employeeCode },
          include: { leaveType: true },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    isApprover
      ? prisma.leaveRequest.findMany({
          where: isHR
            ? { status: { in: ["PENDING_MANAGER", "PENDING_HR"] } }
            : {
                status: "PENDING_MANAGER",
                employee: { profile: { managerCode: session.employeeCode ?? "" } },
              },
          include: { employee: true, leaveType: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="ລາພັກ"
        subtitle={`ປີ ${year}`}
        action={<LinkButton href="/leave/new">+ ຂໍລາພັກ</LinkButton>}
      />

      {session.employeeCode && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {balances.length === 0 && (
            <Card>
              <p className="text-sm text-muted">ຍັງບໍ່ມີ balance ປີນີ້</p>
            </Card>
          )}
          {balances.map((b) => {
            const remain = b.entitled + b.carriedOver - b.used;
            return (
              <StatCard
                key={b.id}
                label={b.leaveType.name}
                value={`${remain} / ${b.entitled + b.carriedOver}`}
                hint={`ໃຊ້ໄປ ${b.used} ວັນ`}
                tone={remain <= 0 ? "bad" : "default"}
              />
            );
          })}
        </div>
      )}

      {isApprover && (
        <div className="mb-8">
          <h2 className="mb-3 font-semibold">ລໍຖ້າອະນຸມັດ ({pending.length})</h2>
          <Table>
            <thead>
              <tr>
                <Th>ພະນັກງານ</Th>
                <Th>ປະເພດ</Th>
                <Th>ຊ່ວງ</Th>
                <Th className="text-center">ວັນ</Th>
                <Th>ສະຖານະ</Th>
                <Th>ຈັດການ</Th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && <EmptyRow colSpan={6} text="ບໍ່ມີຄຳຂໍລໍຖ້າ" />}
              {pending.map((r) => (
                <tr key={r.id}>
                  <Td>{r.employee.fullnameLo}</Td>
                  <Td className="text-xs">{r.leaveType.name}</Td>
                  <Td className="text-xs">
                    {laoDate(r.startDate)} — {laoDate(r.endDate)}
                  </Td>
                  <Td className="text-center tabular">{r.days}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <form action={approveLeave.bind(null, r.id)}>
                        <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:brightness-110">
                          ອະນຸມັດ
                        </button>
                      </form>
                      <form action={rejectLeave.bind(null, r.id)} className="flex items-center gap-1">
                        <input
                          name="reason"
                          placeholder="ເຫດຜົນ"
                          className="w-24 rounded-md border border-border px-2 py-1 text-xs outline-none focus:border-primary"
                        />
                        <button className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:brightness-110">
                          ປฏິເສດ
                        </button>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <h2 className="mb-3 font-semibold">ຄຳຂໍຂອງຂ້ອຍ</h2>
      <Table>
        <thead>
          <tr>
            <Th>ປະເພດ</Th>
            <Th>ຊ່ວງ</Th>
            <Th className="text-center">ວັນ</Th>
            <Th>ເຫດຜົນ</Th>
            <Th>ສະຖານະ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {myRequests.length === 0 && <EmptyRow colSpan={6} text="ຍັງບໍ່ມີຄຳຂໍ" />}
          {myRequests.map((r) => (
            <tr key={r.id}>
              <Td className="text-xs">{r.leaveType.name}</Td>
              <Td className="text-xs">
                {laoDate(r.startDate)} — {laoDate(r.endDate)}
              </Td>
              <Td className="text-center tabular">{r.days}</Td>
              <Td className="text-xs text-muted">
                {r.status === "REJECTED" && r.rejectReason
                  ? `ຖືກປฏິເສດ: ${r.rejectReason}`
                  : (r.reason ?? "-")}
              </Td>
              <Td>
                <Badge tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
              </Td>
              <Td>
                {["DRAFT", "PENDING_MANAGER", "PENDING_HR"].includes(r.status) && (
                  <form action={cancelLeave.bind(null, r.id)}>
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
