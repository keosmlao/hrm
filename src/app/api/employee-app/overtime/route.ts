import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { overtimeRateForEmployee } from "@/lib/overtime-settings";

const schema = z.object({
  idToken: z.string().min(1).optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().trim().max(500).optional(),
});

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const value = parsed.data;
  const auth = await getRequestEmployee(value.idToken);
  if (auth.kind === "unauthenticated") return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  if (auth.kind !== "employee") return NextResponse.json({ error: "employee_not_linked" }, { status: 403 });
  const employee = auth.employee;
  const duration = minutes(value.endTime) - minutes(value.startTime);
  if (duration <= 0 || duration > 12 * 60) return NextResponse.json({ error: "invalid_time_range" }, { status: 400 });
  const workDate = new Date(`${value.workDate}T00:00:00Z`);
  const duplicate = await prisma.overtimeRequest.findFirst({
    where: {
      employeeCode: employee.code,
      workDate,
      status: { in: ["PENDING_MANAGER", "PENDING_HR", "APPROVED"] },
      startTime: value.startTime,
      endTime: value.endTime,
    },
    select: { id: true },
  });
  if (duplicate) return NextResponse.json({ error: "overtime_duplicate" }, { status: 409 });
  const rate = await overtimeRateForEmployee(employee.code, workDate);
  const hours = Math.round((duration / 60) * 100) / 100;
  const result = await prisma.$transaction(async (tx) => {
    const overtime = await tx.overtimeRequest.create({
      data: { employeeCode: employee.code, workDate, startTime: value.startTime, endTime: value.endTime, hours, rate: rate.rate, rateType: rate.rateType, reason: value.reason || null, status: "PENDING_MANAGER" },
    });
    await tx.approvalLog.create({
      data: { entityType: "OvertimeRequest", entityId: overtime.id, action: "SUBMITTED", actorUserId: auth.actorUserId, actorRole: auth.actorRole, comment: `OT ${hours} ຊົ່ວໂມງ` },
    });
    return overtime;
  });
  return NextResponse.json({ ok: true, id: result.id, hours, rate: rate.rate });
}
