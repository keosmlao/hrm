import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { dateKey, distanceMeters, lateMinutesFor, workedMinutesFor } from "@/lib/attendance";
import { getAttendanceLocationPolicy, getEmployeeAttendanceContext } from "@/lib/hrm-settings";

type Body = {
  idToken?: string;
  action?: "IN" | "OUT";
  lat?: number;
  lng?: number;
};

/** ລົງເວລາເຂົ້າ (IN) ຫຼືອອກ (OUT) — 1 ແຖວຕໍ່ພະນັກງານຕໍ່ມື້ */
export async function POST(request: NextRequest) {
  const { idToken, action, lat, lng } = (await request
    .json()
    .catch(() => ({}))) as Body;

  if (action !== "IN" && action !== "OUT") {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  const auth = await getRequestEmployee(idToken);
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (auth.kind !== "employee") {
    return NextResponse.json({ linked: false }, { status: 409 });
  }
  const employee = auth.employee;

  const locationPolicy = await getAttendanceLocationPolicy();
  if (locationPolicy.required) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "location_required" }, { status: 400 });
    }
    if (locationPolicy.latitude === null || locationPolicy.longitude === null) {
      return NextResponse.json({ error: "location_not_configured" }, { status: 503 });
    }
    const distance = distanceMeters(lat!, lng!, locationPolicy.latitude, locationPolicy.longitude);
    if (distance > locationPolicy.radiusMeters) {
      return NextResponse.json({ error: "outside_work_location", distanceMeters: Math.round(distance) }, { status: 403 });
    }
  }

  const now = new Date();
  const { policy, workDate } = await getEmployeeAttendanceContext(employee.code, now);
  const key = { employeeCode_workDate: { employeeCode: employee.code, workDate } };

  if (action === "IN") {
    const [holiday, dayOff, approvedLeave] = await Promise.all([
      prisma.publicHoliday.findUnique({ where: { date: workDate }, select: { id: true } }),
      prisma.employeeDayOff.findUnique({
        where: { employeeCode_date: { employeeCode: employee.code, date: workDate } },
        select: { id: true },
      }),
      prisma.leaveRequest.findFirst({
        where: {
          employeeCode: employee.code,
          status: "APPROVED",
          startDate: { lte: workDate },
          endDate: { gte: workDate },
        },
        select: { id: true },
      }),
    ]);
    if (!policy.workDays.includes(workDate.getUTCDay()) || holiday || dayOff || approvedLeave) {
      return NextResponse.json({ error: "not_scheduled_workday" }, { status: 409 });
    }
    const lateMinutes = lateMinutesFor(
      now,
      policy.workStart,
      policy.lateGraceMinutes,
      policy.workEnd,
    );
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${employee.code}:${dateKey(workDate)}`}, 0))`;
      const existing = await tx.attendance.findUnique({ where: key });
      if (existing?.checkInAt) return { error: "already_checked_in" as const };
      const row = existing
        ? await tx.attendance.update({
            where: { id: existing.id },
            data: { checkInAt: now, lateMinutes, checkInLat: lat ?? null, checkInLng: lng ?? null },
            select: { id: true, checkInAt: true, checkOutAt: true, lateMinutes: true, workedMinutes: true },
          })
        : await tx.attendance.create({
            data: {
              employeeCode: employee.code,
              workDate,
              checkInAt: now,
              lateMinutes,
              checkInLat: lat ?? null,
              checkInLng: lng ?? null,
            },
            select: { id: true, checkInAt: true, checkOutAt: true, lateMinutes: true, workedMinutes: true },
          });
      return { row };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
    await prisma.auditLog.create({
      data: {
        action: "CLOCK_IN",
        entityType: "Attendance",
        entityId: result.row.id,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        detail: JSON.stringify({ employeeCode: employee.code, workDate: dateKey(workDate), lateMinutes, lat: lat ?? null, lng: lng ?? null }),
      },
    });
    return NextResponse.json({ ok: true, today: result.row });
  }

  // action === "OUT"
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${employee.code}:${dateKey(workDate)}`}, 0))`;
    const existing = await tx.attendance.findUnique({ where: key });
    if (!existing?.checkInAt) return { error: "not_checked_in" as const };
    if (existing.checkOutAt) return { error: "already_checked_out" as const };
    const row = await tx.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        workedMinutes: workedMinutesFor(existing.checkInAt, now),
        checkOutLat: lat ?? null,
        checkOutLng: lng ?? null,
      },
      select: { id: true, checkInAt: true, checkOutAt: true, lateMinutes: true, workedMinutes: true },
    });
    return { row };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  await prisma.auditLog.create({
    data: {
      action: "CLOCK_OUT",
      entityType: "Attendance",
      entityId: result.row.id,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      detail: JSON.stringify({ employeeCode: employee.code, workDate: dateKey(workDate), lat: lat ?? null, lng: lng ?? null }),
    },
  });
  return NextResponse.json({ ok: true, today: result.row });
}
