import "server-only";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

/** ບັນທຶກຮູບໃສ່ public/uploads/<folder> ຂອງ project → ຄືນ URL (/uploads/...) */
export async function saveUpload(file: File, folder = "trips"): Promise<{ url?: string; error?: string }> {
  if (!ALLOWED.has(file.type)) return { error: "bad_type" };
  if (file.size > MAX_BYTES) return { error: "too_large" };
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "") || "trips";
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", safeFolder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/${safeFolder}/${filename}` };
}
