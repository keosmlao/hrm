import "server-only";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * ບ່ອນເກັບໄຟລ໌ແນບຂອງຄັງຄວາມຮູ້.
 *
 * ⚠ **ບໍ່ໄດ້ເກັບໃນ `public/`** ຕ່າງຈາກ `upload.ts` ທີ່ໃຊ້ກັບຮູບບິນ/ຮູບ check-in —
 * ເອກະສານພາຍໃນ (ນະໂຍບາຍ, ໂຄງສ້າງເງິນເດືອນ) ຖ້າວາງໃນ public ໃຜມີ URL ກໍເປີດໄດ້
 * ໂດຍບໍ່ຕ້ອງ login. ຈຶ່ງເກັບນອກ webroot ແລ້ວເສີບຜ່ານ `/api/kb-file/[id]`
 * ທີ່ກວດ session + ຂອບເຂດການເຫັນຂອງບົດກ່ອນ.
 *
 * ຕັ້ງບ່ອນເກັບດ້ວຍ env `KB_UPLOAD_DIR` ໄດ້ (ຄວນຕັ້ງເມື່ອ deploy ເພື່ອບໍ່ໃຫ້
 * ໄຟລ໌ຫາຍຕອນ build ໃໝ່); ຄ່າເລີ່ມຕົ້ນ = `<project>/private-uploads/kb`.
 */

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

/** ນາມສະກຸນ → mime ທີ່ຍອມຮັບ. ບໍ່ຮັບ .html/.svg ເພາະ render ແລ້ວແລ່ນ script ໄດ້ */
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

export const KB_ACCEPT = Object.keys(ALLOWED)
  .map((e) => `.${e}`)
  .join(",");

export const KB_MAX_MB = MAX_BYTES / 1024 / 1024;

export type KbSaveError = "bad_type" | "too_large" | "no_file";

function storageDir() {
  return process.env.KB_UPLOAD_DIR?.trim() || path.join(process.cwd(), "private-uploads", "kb");
}

function extOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop()!.replace(/[^a-z0-9]/g, "") : "";
}

/** ບັນທຶກໄຟລ໌ແນບ → ຄືນຊື່ທີ່ເກັບຈິງ (ບໍ່ແມ່ນຊື່ເດີມ ຈຶ່ງກັນຊື່ຊ້ຳ/ຊື່ອັນຕະລາຍ) */
export async function saveKbFile(
  file: File,
): Promise<{ storedName: string; mime: string; sizeBytes: number; name: string } | { error: KbSaveError }> {
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };
  if (file.size > MAX_BYTES) return { error: "too_large" };

  const ext = extOf(file.name);
  const mime = ALLOWED[ext];
  if (!mime) return { error: "bad_type" };

  const storedName = `${randomUUID()}.${ext}`;
  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));

  return {
    storedName,
    mime,
    sizeBytes: file.size,
    // ຊື່ທີ່ສະແດງ — ຕັດ path ອອກ ກັນ "../" ຈາກ browser ແປກໆ
    name: path.basename(file.name).slice(0, 200),
  };
}

/** ອ່ານໄຟລ໌ຄືນ — ຄືນ null ຖ້າຊື່ຜິດຮູບແບບ ຫຼື ໄຟລ໌ຫາຍ */
export async function readKbFile(storedName: string): Promise<Buffer | null> {
  // ຊື່ມາຈາກ DB ແຕ່ຍັງກວດຮູບແບບຢູ່ດີ — ກັນ path traversal ຖ້າແຖວຖືກແກ້
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(storedName)) return null;
  return readFile(path.join(storageDir(), storedName)).catch(() => null);
}

export async function deleteKbFile(storedName: string): Promise<void> {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(storedName)) return;
  await unlink(path.join(storageDir(), storedName)).catch(() => {});
}

/** ເປີດໃນ browser ໄດ້ເລີຍບໍ່ (PDF/ຮູບ) ຫຼື ຕ້ອງດາວໂຫຼດ */
export function isInlineViewable(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
