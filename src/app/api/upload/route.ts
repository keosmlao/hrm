import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { saveUpload } from "@/lib/upload";

export const runtime = "nodejs";

/** ອັບໂຫຼດຮູບ → ເກັບໃນ public/uploads/<folder> ຂອງ project, ຄືນ URL */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["ADMIN", "HR", "MANAGER", "EXECUTIVE"].includes(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });

  const folder = (form?.get("folder") ?? "trips").toString();
  const result = await saveUpload(file, folder);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ url: result.url });
}
