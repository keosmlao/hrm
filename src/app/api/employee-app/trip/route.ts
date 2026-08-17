import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { isValidTripTimeRange } from "@/lib/trip";

const schema = z.object({
  idToken: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicleId: z.string().regex(/^\d+$/),
  isVehicleBorrower: z.boolean().optional(),
  tripNo: z.number().int().min(1).max(99).optional(),
  destination: z.string().trim().min(1).max(200),
  departTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  returnTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const value = parsed.data;

  const auth = await getRequestEmployee(value.idToken);
  if (auth.kind === "unauthenticated") return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  if (auth.kind !== "employee") return NextResponse.json({ error: "employee_not_linked" }, { status: 403 });
  const employee = auth.employee;

  const date = new Date(`${value.date}T00:00:00Z`);
  const endDate = new Date(`${value.endDate}T00:00:00Z`);
  if (endDate < date) return NextResponse.json({ error: "invalid_date_range" }, { status: 400 });
  if (!isValidTripTimeRange(date, endDate, value.departTime, value.returnTime)) return NextResponse.json({ error: "invalid_time_range" }, { status: 400 });
  const tripNo = value.tripNo ?? 1;

  // ກັນຮ້ອງຂໍຊ້ຳ (ຄົນດຽວກັນ · ວັນດຽວກັນ · ຄັ້ງດຽວກັນ) ທີ່ຍັງບໍ່ຖືກປະຕິເສດ
  const dup = await prisma.vehicleTrip.findFirst({
    where: {
      requestedByCode: employee.code,
      tripType: "SALE",
      workflowStatus: "PLANNED",
      date: { lte: endDate },
      endDate: { gte: date },
      tripNo,
      OR: [{ approvedAt: { not: null } }, { status: { not: "CANCELLED" } }],
    },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ error: "trip_duplicate" }, { status: 409 });

  const trip = await prisma.vehicleTrip.create({
    data: {
      date,
      endDate,
      tripNo,
      destination: value.destination,
      departTime: value.departTime || null,
      returnTime: value.returnTime || null,
      note: value.note || null,
      // ຄຳຮ້ອງນີ້ເປັນ trip ຂາຍ (dedup ຂ້າງເທິງກໍ່ອີງ tripType SALE)
      tripType: "SALE",
      workflowStatus: "PLANNED",
      isVehicleBorrower: value.isVehicleBorrower ?? false,
      // ຄຳຮ້ອງ: ຍັງບໍ່ໄດ້ຈັດລົດ / ຍັງບໍ່ອະນຸມັດ
      vehicleId: null,
      requestedByCode: employee.code,
      approvedAt: null,
      // ຜູ້ຮ້ອງຂໍ ຖືວ່າໄປ trip ນຳ
      members: { create: [{ employeeCode: employee.code }] },
    },
  });

  return NextResponse.json({ ok: true, id: trip.id });
}
