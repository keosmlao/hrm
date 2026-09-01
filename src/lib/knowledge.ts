/**
 * ກົດເກນຂອງຄັງຄວາມຮູ້ — ສະຖານະ, ການເຫັນ, ແທັກ.
 *
 * ບໍ່ import server-only / prisma ຈຶ່ງ `npm test` ໂຫຼດໄດ້ ແລະ client component ໃຊ້ໄດ້
 * (ແບບດຽວກັບ `menu.ts` / `position-level.ts`).
 *
 * ⚠ ສະຖານະ ແລະ ການເຫັນ ເກັບເປັນ **text** ໃນ DB ບໍ່ແມ່ນ enum ຂອງ Postgres —
 * ຄ່າທີ່ຮັບໄດ້ຢູ່ນີ້ບ່ອນດຽວ. ຢ່າຂຽນຄ່າດິບກະແຈກກະຈາຍໃນໜ້າອື່ນ.
 */

import type { Role } from "./menu";

export const KB_STATUSES = ["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED"] as const;
export type KbStatus = (typeof KB_STATUSES)[number];

export const KB_STATUS_LABEL: Record<KbStatus, string> = {
  DRAFT: "ຮ່າງ",
  PENDING: "ລໍອະນຸມັດ",
  PUBLISHED: "ເຜີຍແຜ່ແລ້ວ",
  ARCHIVED: "ເກັບເຂົ້າຄັງ",
};

export const KB_STATUS_TONE: Record<KbStatus, "gray" | "amber" | "green" | "blue"> = {
  DRAFT: "gray",
  PENDING: "amber",
  PUBLISHED: "green",
  ARCHIVED: "blue",
};

export const KB_VISIBILITIES = ["ALL", "DEPARTMENT", "ROLE"] as const;
export type KbVisibility = (typeof KB_VISIBILITIES)[number];

export const KB_VISIBILITY_LABEL: Record<KbVisibility, string> = {
  ALL: "ທຸກຄົນ",
  DEPARTMENT: "ສະເພາະພະແນກທີ່ເລືອກ",
  ROLE: "ສະເພາະສິດທີ່ເລືອກ",
};

export function isKbStatus(v: string): v is KbStatus {
  return (KB_STATUSES as readonly string[]).includes(v);
}

export function isKbVisibility(v: string): v is KbVisibility {
  return (KB_VISIBILITIES as readonly string[]).includes(v);
}

/**
 * ຜູ້ດູແລຄັງໂດຍຄ່າເລີ່ມຕົ້ນ = ADMIN/HR — ສ້າງ, ແກ້, ອະນຸມັດ ແລະ ເຫັນຮ່າງທັງໝົດ.
 *
 * ນີ້ເປັນພຽງ**ຄ່າເລີ່ມຕົ້ນ**. ສິດຈິງມາຈາກເມນູ `knowledge.manage` ໃນໜ້າຕັ້ງຄ່າສິດ
 * ຈຶ່ງມອບໃຫ້ MANAGER ໄດ້ໂດຍບໍ່ຕ້ອງແກ້ code — ເບິ່ງ `kb-access.ts`.
 */
export function canManageKb(role: Role): boolean {
  return role === "ADMIN" || role === "HR";
}

export type KbViewer = {
  role: Role;
  employeeCode: string | null;
  departmentCode: string | null;
  /** ດູແລຄັງໄດ້ບໍ — ຄິດຈາກສິດເມນູ `knowledge.manage` ບໍ່ແມ່ນ role ດ້ວຍໆ */
  canManage: boolean;
};

export type KbVisibilityFields = {
  status: string;
  visibility: string;
  visibleDepartments: string[];
  visibleRoles: string[];
  authorCode: string | null;
};

/**
 * ຜູ້ໃຊ້ຄົນນີ້ເປີດບົດນີ້ໄດ້ບໍ່.
 *
 * ລຳດັບການຕັດສິນ:
 *   1. ຜູ້ດູແລຄັງ → ໄດ້ໝົດ ລວມທັງຮ່າງ
 *   2. ຜູ້ຂຽນເອງ → ເຫັນຂອງຕົນເອງ ເຖິງຈະຍັງບໍ່ເຜີຍແຜ່
 *   3. ຄົນອື່ນ → ຕ້ອງ PUBLISHED ກ່ອນ ແລ້ວຈຶ່ງກວດຂອບເຂດການເຫັນ
 *
 * ⚠ ນີ້ແມ່ນກົດ ບໍ່ແມ່ນຄວາມປອດໄພດ້ວຍຕົວມັນເອງ — ຕ້ອງເອີ້ນຈາກຝັ່ງເຊີບເວີ
 * ທັງຕອນ query ລາຍການ ແລະ ຕອນເປີດບົດດ່ຽວ.
 */
export function canReadArticle(article: KbVisibilityFields, viewer: KbViewer): boolean {
  if (viewer.canManage) return true;
  if (article.authorCode && viewer.employeeCode && article.authorCode === viewer.employeeCode) {
    return true;
  }
  if (article.status !== "PUBLISHED") return false;

  switch (article.visibility) {
    case "DEPARTMENT":
      return !!viewer.departmentCode && article.visibleDepartments.includes(viewer.departmentCode);
    case "ROLE":
      return article.visibleRoles.includes(viewer.role);
    default:
      return true;
  }
}

/** "ຄວາມປອດໄພ, ນະໂຍບາຍ , HR" → ["ຄວາມປອດໄພ", "ນະໂຍບາຍ", "HR"] (ບໍ່ຊ້ຳ, ສູງສຸດ 12) */
export function parseTags(raw: string | null | undefined): string[] {
  const parts = (raw ?? "")
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 40);
  return [...new Set(parts)].slice(0, 12);
}

export function formatTags(tags: string[]): string {
  return tags.join(", ");
}

/**
 * ຕ້ອງກົດ "ຮັບຮູ້" ບໍ່ — ຮັບຮູ້ຜູກກັບ **ເລກຮຸ່ນ** ຈຶ່ງແກ້ນະໂຍບາຍແລ້ວ
 * ພະນັກງານທີ່ເຄີຍຮັບຮູ້ຮຸ່ນເກົ່າ ຕ້ອງກັບມາຮັບຮູ້ໃໝ່.
 */
export function needsAck(
  article: { requiresAck: boolean; status: string; version: number },
  ackedVersions: number[],
): boolean {
  if (!article.requiresAck || article.status !== "PUBLISHED") return false;
  return !ackedVersions.includes(article.version);
}
