import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { eachScheduledWorkingDay } from "@/lib/attendance";
import { getEmployeeAttendancePolicy, getEmployeeDayOffKeys, getPublicHolidayKeys } from "@/lib/hrm-settings";

const schema = z.object({
  idToken: z.string().min(1).optional(),
  leaveTypeId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
  proofUrl: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const value = parsed.data;
  const auth = await getRequestEmployee(value.idToken);
  if (auth.kind === "unauthenticated") return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  if (auth.kind !== "employee") return NextResponse.json({ error: "employee_not_linked" }, { status: 403 });
  const employee = auth.employee;
  if (value.endDate < value.startDate) return NextResponse.json({ error: "invalid_date_range" }, { status: 400 });

  const startDate = new Date(`${value.startDate}T00:00:00Z`);
  const endDate = new Date(`${value.endDate}T00:00:00Z`);
  const [leaveType, holidayKeys, employeeDaysOff, policy, overlap] = await Promise.all([
    prisma.leaveType.findFirst({ where: { id: value.leaveTypeId, isActive: true } }),
    getPublicHolidayKeys(startDate, endDate),
    getEmployeeDayOffKeys(employee.code, startDate, endDate),
    getEmployeeAttendancePolicy(employee.code, startDate),
    prisma.leaveRequest.findFirst({
      where: {
        employeeCode: employee.code,
        status: { in: ["PENDING_MANAGER", "PENDING_HR", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    }),
  ]);
  if (!leaveType) return NextResponse.json({ error: "invalid_leave_type" }, { status: 400 });
  if (leaveType.requiresProof && !value.proofUrl) return NextResponse.json({ error: "proof_required" }, { status: 400 });
  if (overlap) return NextResponse.json({ error: "leave_overlap" }, { status: 409 });
  const excludedDates = new Set([...holidayKeys, ...employeeDaysOff]);
  const days = eachScheduledWorkingDay(startDate, endDate, policy.scheduleType === "ROTATING", excludedDates, new Set(policy.workDays)).length;
  if (days <= 0) return NextResponse.json({ error: "no_working_day" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.create({
      data: {
        employeeCode: employee.code,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        days,
        reason: value.reason || null,
        proofUrl: value.proofUrl || null,
        status: "PENDING_MANAGER",
      },
    });
    await tx.approvalLog.create({
      data: { entityType: "LeaveRequest", entityId: leave.id, action: "SUBMITTED", actorUserId: auth.actorUserId, actorRole: auth.actorRole, comment: `ຂໍລາ ${days} ວັນ` },
    });
    return leave;
  });
  return NextResponse.json({ ok: true, id: result.id, days });
}
