import { type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/fuel-photo?id=<odg_tms_fuel_log.id> — ຮູບບິນນ້ຳມັນຂອງແອັບຂົນສົ່ງ (TMS)
 * TMS ເກັບເປັນ data URI base64 ໃນຖັນ image_data → ຖອດອອກສົ່ງເປັນຮູບ (ບໍ່ໃຫ້ໜ້າ HTML ແບກ base64)
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("unauthenticated", { status: 401 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^\d+$/.test(id)) return new Response("bad id", { status: 400 });

  const rows = await prisma.$queryRaw<{ image_data: string | null }[]>`
    select image_data from odg_tms_fuel_log where id = ${BigInt(id)}`;
  const data = rows[0]?.image_data?.trim();
  if (!data) return new Response("not found", { status: 404 });

  const m = /^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]+)$/.exec(data);
  if (!m) return new Response("unsupported", { status: 415 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=3600" },
  });
}
