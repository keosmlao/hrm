import { type NextRequest } from "next/server";
import { getSession } from "@/lib/session";

/**
 * GET /api/photo-proxy?f=<token>  — ຮູບບິນນ້ຳມັນ / check-in ທີ່ເກັບຢູ່ server SALE (photo-store)
 * ຕ້ອງ login HRM; ດຶງຈາກ SALE_BASE_URL/api/photos/internal ດ້ວຍ SALE_PHOTO_KEY ແລ້ວສົ່ງຕໍ່
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("unauthenticated", { status: 401 });
  const base = process.env.SALE_BASE_URL?.replace(/\/$/, "");
  const key = process.env.SALE_PHOTO_KEY;
  if (!base || !key) return new Response("SALE_BASE_URL / SALE_PHOTO_KEY ຍັງບໍ່ໄດ້ຕັ້ງ", { status: 503 });
  const f = request.nextUrl.searchParams.get("f") ?? "";
  if (!/^file:[\w-]+\/[\w.-]+$/.test(f)) return new Response("bad token", { status: 400 });
  const upstream = await fetch(`${base}/api/photos/internal?f=${encodeURIComponent(f)}`, { headers: { "x-internal-key": key }, cache: "no-store" }).catch(() => null);
  if (!upstream || !upstream.ok) return new Response("not found", { status: upstream?.status ?? 502 });
  return new Response(upstream.body, {
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
