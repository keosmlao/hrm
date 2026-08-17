import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { currentStepInfo } from "@/lib/trip-approvals";

const schema = z.object({
  idToken: z.string().min(1).optional(),
  tripId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional(),
});

/** ຫົວໜ້າ/ຜູ້ອະນຸມັດ (role EMPLOYEE) ອະນຸມັດ/ປະຕິເສດ ຄຳຮ້ອງໃຊ້ລົດ ຜ່ານ app */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const value = parsed.data;

  const auth = await getRequestEmployee(value.idToken);
  if (auth.kind === "unauthenticated") return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  if (auth.kind !== "employee") return NextResponse.json({ error: "employee_not_linked" }, { status: 403 });
  const employee = auth.employee;

  const trip = await prisma.vehicleTrip.findUnique({ where: { id: value.tripId } });
  if (!trip || !trip.requestedByCode || trip.approvedAt !== null || trip.status === "CANCELLED") {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }
  if (trip.requestedByCode === employee.code) return NextResponse.json({ error: "own_request" }, { status: 403 });

  const info = await currentStepInfo(trip);
  if (info.done || !info.approvers.has(employee.code)) return NextResponse.json({ error: "not_approver" }, { status: 403 });

  if (value.action === "APPROVE") {
    await prisma.vehicleTrip.update({ where: { id: trip.id }, data: { approvalLevel: { increment: 1 } } });
    await prisma.auditLog.create({ data: { userId: null, action: "APPROVE_STEP", entityType: "VehicleTrip", entityId: trip.id, detail: JSON.stringify({ by: employee.code, level: trip.approvalLevel + 1, of: info.totalSteps }) } });
  } else {
    await prisma.vehicleTrip.update({ where: { id: trip.id }, data: { status: "CANCELLED", workflowStatus: "CANCELLED", rejectReason: value.reason || "ຄຳຮ້ອງຖືກປະຕິເສດ" } });
    await prisma.auditLog.create({ data: { userId: null, action: "REJECT", entityType: "VehicleTrip", entityId: trip.id, detail: JSON.stringify({ by: employee.code, reason: value.reason }) } });
  }

  revalidatePath("/fleet/trips");
  return NextResponse.json({ ok: true });
}
