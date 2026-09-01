import { type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { attachmentForViewer, viewerFrom } from "@/lib/kb-access";
import { isInlineViewable, readKbFile } from "@/lib/kb-storage";

export const runtime = "nodejs";

/**
 * GET /api/kb-file/<attachmentId>  — ໄຟລ໌ແນບຂອງຄັງຄວາມຮູ້.
 *
 * ໄຟລ໌ເກັບ**ນອກ** `public/` ຈຶ່ງເຂົ້າເຖິງໄດ້ທາງນີ້ທາງດຽວ ແລະ ຜ່ານ 2 ດ່ານ:
 *   1. ຕ້ອງ login
 *   2. ຕ້ອງເປີດ**ບົດ**ທີ່ໄຟລ໌ຕິດຢູ່ໄດ້ (ຂອບເຂດການເຫັນອັນດຽວກັນ)
 *
 * ໃສ່ `?download=1` ເພື່ອບັງຄັບດາວໂຫຼດແທນການເປີດເບິ່ງ.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("unauthenticated", { status: 401 });

  const { id } = await params;
  const file = await attachmentForViewer(id, await viewerFrom(session));
  if (!file) return new Response("not found", { status: 404 });

  const body = await readKbFile(file.storedName);
  if (!body) return new Response("file missing", { status: 410 });

  const forceDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = !forceDownload && isInlineViewable(file.mime) ? "inline" : "attachment";
  // ຊື່ໄຟລ໌ເປັນພາສາລາວໄດ້ ຈຶ່ງໃຊ້ filename* (RFC 5987) — ຊື່ ASCII ສຳຮອງໄວ້ໃຫ້ browser ເກົ່າ
  const asciiName = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(body.length),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
