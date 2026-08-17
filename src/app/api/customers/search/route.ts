import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** ຄົ້ນຫາ ຮ້ານຄ້າ/ລູກຄ້າ ຈາກ ar_customer (typeahead) — ໃຊ້ຕອນວາງແຜນ Sale Trip */
export async function GET(request: NextRequest) {
  // API: ຄືນ JSON status ແທນ redirect (ໃຫ້ fetch ອ່ານໄດ້ຖືກ)
  const session = await getSession();
  if (!session) return NextResponse.json({ items: [], error: "unauthenticated" }, { status: 401 });
  if (!["ADMIN", "HR", "MANAGER", "EXECUTIVE"].includes(session.role)) {
    return NextResponse.json({ items: [], error: "forbidden" }, { status: 403 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const rows = await prisma.arCustomer.findMany({
    where: {
      status: 0, // 0 = ໃຊ້ໄດ້ (1 = ຫ້າມໃຊ້)
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { name1: { contains: q, mode: "insensitive" } },
        { telephone: { contains: q } },
      ],
    },
    select: { code: true, name1: true, telephone: true, province: true, address: true },
    take: 20,
    orderBy: { name1: "asc" },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      code: r.code,
      name: r.name1 ?? r.code,
      phone: r.telephone ?? null,
      address: r.address ?? null,
    })),
  });
}
