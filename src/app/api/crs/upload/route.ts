import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCrsViewer } from "@/lib/server/crs";
import { jsonError } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const viewer = await getCrsViewer(session);

    if (!viewer) {
      return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);
    }
    if (!viewer.canManage) {
      return jsonError("ສິດນີ້ສະເພາະ IT ຫຼື HR", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("ບໍ່ພົບ file ທີ່ອັບໂຫຼດ", 400);
    }
    if (!(file.type in ALLOWED_IMAGE_TYPES)) {
      return jsonError("ຮອງຮັບສະເພາະ PNG, JPG, WEBP ແລະ GIF", 400);
    }
    if (file.size === 0) {
      return jsonError("file ວ່າງເປົ່າ", 400);
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return jsonError("ຮູບຕ້ອງບໍ່ເກີນ 5MB", 400);
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "crs");
    await mkdir(uploadDir, { recursive: true });

    const extension = ALLOWED_IMAGE_TYPES[file.type];
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const filePath = path.join(uploadDir, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(filePath, bytes);

    return NextResponse.json({
      fileName,
      url: `/uploads/crs/${fileName}`,
    });
  } catch (error) {
    console.error("Failed to upload CRS image:", error);
    return jsonError("ບໍ່ສາມາດອັບໂຫຼດຮູບໄດ້", 500);
  }
}
