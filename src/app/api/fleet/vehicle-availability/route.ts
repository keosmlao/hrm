import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ກວດລົດວ່າງກ່ອນສົ່ງຟອມ Trip — server action ຈະກວດຊ້ຳອີກຄັ້ງຕອນບັນທຶກ */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const vehicleId = request.nextUrl.searchParams.get("vehicleId") ?? "";
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!/^\d+$/.test(vehicleId) || !DATE_RE.test(from) || !DATE_RE.test(to) || to < from) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const overlaps = await prisma.vehicleTrip.findMany({
    where: {
      vehicleId,
      status: { not: "CANCELLED" },
      date: { lte: toDate },
      endDate: { gte: fromDate },
    },
    select: {
      id: true,
      tripNo: true,
      destination: true,
      date: true,
      endDate: true,
      departTime: true,
      returnTime: true,
      status: true,
    },
    orderBy: [{ date: "asc" }, { tripNo: "asc" }],
    take: 10,
  });

  // ກົງກັບ createTrip: Trip ມື້ດຽວອາດມີຫຼາຍຮອບໄດ້; ຊ່ວງຫຼາຍມື້ຈະ block.
  const candidateIsMultiDay = from !== to;
  const blocked = overlaps.some(
    (trip) => candidateIsMultiDay || trip.date.getTime() !== trip.endDate.getTime(),
  );

  return NextResponse.json({
    available: !blocked,
    blocked,
    trips: overlaps.map((trip) => ({
      id: trip.id,
      tripNo: trip.tripNo,
      destination: trip.destination,
      from: trip.date.toISOString().slice(0, 10),
      to: trip.endDate.toISOString().slice(0, 10),
      departTime: trip.departTime,
      returnTime: trip.returnTime,
      status: trip.status,
    })),
  });
}
