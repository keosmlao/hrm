import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { laoDate, laoDateTime } from "@/lib/format";
import { CorrectionForm } from "./correction-form";
import { approveAttendanceCorrection, cancelAttendanceCorrection, rejectAttendanceCorrection } from "./actions";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "ລໍຖ້າກວດ",
  APPROVED: "ອະນຸມັດແລ້ວ",
  REJECTED: "ບໍ່ອະນຸມັດ",
  CANCELLED: "ຍົກເລີກ",
};
const STATUS_TONE: Record<string, "amber" | "green" | "red" | "gray"> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export default async function AttendanceCorrectionsPage() {
  const session = await requireUser();
  const canManage = hasRole(session, "ADMIN", "HR");
  const requestWhere: Prisma.AttendanceCorrectionRequestWhereInput = canManage
    ? {}
    : session.role === "MANAGER"
      ? { OR: [{ employeeCode: session.employeeCode ?? "" }, { employee: { profile: { managerCode: session.employeeCode ?? "" } } }] }
      : { employeeCode: session.employeeCode ?? "" };
  const employeeWhere: Prisma.EmployeeWhereInput = canManage
    ? { employmentStatus: "ACTIVE" }
    : session.role === "MANAGER"
      ? { employmentStatus: "ACTIVE", OR: [{ code: session.employeeCode ?? "" }, { profile: { managerCode: session.employeeCode ?? "" } }] }
      : { code: session.employeeCode ?? "" };

  const [requests, employees] = await Promise.all([
    prisma.attendanceCorrectionRequest.findMany({
      where: requestWhere,
      include: { employee: { select: { fullnameLo: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.employee.findMany({
      where: employeeWhere,
      select: { code: true, fullnameLo: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const fmtTime = (date: Date | null) => date
    ? new Intl.DateTimeFormat("lo-LA", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Vientiane" }).format(date)
    : "-";

  return (
    <>
      <PageHeader
        title="ຄຳຂແກ້ໄຂການລົງເວລາ"
        subtitle="ຂໍແກ້ໄຂເວລາເຂົ້າ–ອອກ ແລະຕິດຕາມການອະນຸມັດ"
        action={<Link href="/attendance" className="text-sm text-primary hover:underline">← ກັບໄປສະຫຼຸບ</Link>}
      />
      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ສົ່ງຄຳຂໃໝ່</h2>
        <CorrectionForm employees={employees.map((employee) => ({ code: employee.code, name: employee.fullnameLo }))} employeeCode={session.employeeCode} canChooseEmployee={canManage} />
      </Card>

      <Table>
        <thead><tr><Th>ພະນັກງານ</Th><Th>ວັນທີ</Th><Th>ເຂົ້າໃໝ່</Th><Th>ອອກໃໝ່</Th><Th>ເຫດຜົນ</Th><Th>ສະຖານະ</Th><Th>ສົ່ງເມື່ອ</Th><Th>ຈັດການ</Th></tr></thead>
        <tbody>
          {requests.length === 0 && <EmptyRow colSpan={8} />}
          {requests.map((request) => {
            const canReview = canManage || (session.role === "MANAGER" && request.employeeCode !== session.employeeCode);
            return (
              <tr key={request.id}>
                <Td>{request.employeeCode} · {request.employee.fullnameLo}</Td>
                <Td>{laoDate(request.workDate)}</Td>
                <Td>{fmtTime(request.requestedCheckInAt)}</Td>
                <Td>{fmtTime(request.requestedCheckOutAt)}</Td>
                <Td className="max-w-64 text-xs text-muted">{request.reason}</Td>
                <Td><Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge></Td>
                <Td className="whitespace-nowrap text-xs">{laoDateTime(request.createdAt)}</Td>
                <Td>
                  {request.status === "PENDING" && canReview && (
                    <div className="flex flex-wrap gap-2">
                      <form action={approveAttendanceCorrection.bind(null, request.id)}><button className="text-xs font-medium text-emerald-600 hover:underline">ອະນຸມັດ</button></form>
                      <form action={rejectAttendanceCorrection.bind(null, request.id)} className="flex gap-1"><input name="reviewNote" placeholder="ເຫດຜົນ" className="w-24 rounded border border-border px-1 text-xs" /><button className="text-xs font-medium text-rose-600 hover:underline">ປະຕິເສດ</button></form>
                    </div>
                  )}
                  {request.status === "PENDING" && request.requesterUserId === session.userId && (
                    <form action={cancelAttendanceCorrection.bind(null, request.id)}><button className="text-xs text-muted hover:underline">ຍົກເລີກ</button></form>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

export const dynamic = "force-dynamic";
