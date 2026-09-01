import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { requireUser } from "./auth";
import type { SessionPayload } from "./session";
import { canManageKb, canReadArticle, type KbViewer } from "./knowledge";
import { ACTIVE_EMPLOYEE } from "./employee-status";
import { allowedMenuKeys } from "./permissions";
import type { Prisma } from "@/generated/prisma/client";

/**
 * ຊັ້ນອ່ານຂໍ້ມູນຄັງຄວາມຮູ້ ພ້ອມບັງຄັບຂອບເຂດການເຫັນ.
 *
 * ກົດການເຫັນຢູ່ `knowledge.ts` (ບໍລິສຸດ, ມີ test). ຢູ່ນີ້ແມ່ນ
 * ການແປງກົດນັ້ນເປັນ `where` ຂອງ Prisma ເພື່ອບໍ່ດຶງບົດທີ່ບໍ່ມີສິດອອກມາຕັ້ງແຕ່ຕົ້ນ
 * — ແລ້ວຍັງກວດຊ້ຳດ້ວຍ `canReadArticle` ຕອນເປີດບົດດ່ຽວອີກຊັ້ນ.
 */

/** ລະຫັດທີ່ບໍ່ມີທາງກົງກັບແຖວໃດ — ໃຊ້ຕອນຜູ້ໃຊ້ບໍ່ໄດ້ຜູກກັບພະນັກງານ */
const NO_MATCH = "__none__";

export async function viewerFrom(session: SessionPayload): Promise<KbViewer> {
  const [employee, allowed] = await Promise.all([
    session.employeeCode
      ? prisma.employee.findUnique({
          where: { code: session.employeeCode },
          select: { departmentCode: true },
        })
      : null,
    // ສິດດູແລຄັງມາຈາກເມນູ `knowledge.manage` ຈຶ່ງມອບໃຫ້ MANAGER ໄດ້ຈາກໜ້າຕັ້ງຄ່າສິດ
    // (ຄ່າເລີ່ມຕົ້ນຂອງເມນູນັ້ນ = ADMIN/HR ຄືກັນກັບ `canManageKb`)
    allowedMenuKeys(session.role, session.userId),
  ]);

  return {
    role: session.role,
    employeeCode: session.employeeCode,
    departmentCode: employee?.departmentCode ?? null,
    canManage: allowed.has("knowledge.manage") || canManageKb(session.role),
  };
}

/**
 * ຜູ້ອ່ານຈາກ **ແອັບພະນັກງານ** (LINE mini-app / portal).
 *
 * `canManage: false` ສະເໝີ — ແອັບພະນັກງານເປັນຝ່າຍອ່ານຢ່າງດຽວ ເຖິງຄົນນັ້ນຈະເປັນ HR
 * (ຈັດການຄັງເຮັດຢູ່ເວັບ HRM). ຄົນທີ່ເຂົ້າຜ່ານ LINE ບໍ່ມີບັນຊີ `hrm_user` ຈຶ່ງ
 * ອ່ານສິດເມນູບໍ່ໄດ້ຢູ່ແລ້ວ.
 */
export function employeeViewer(
  employee: { code: string; departmentCode: string | null },
  role: KbViewer["role"],
): KbViewer {
  return {
    role,
    employeeCode: employee.code,
    departmentCode: employee.departmentCode,
    canManage: false,
  };
}

/** ໃຊ້ໃນໜ້າ — ບັງຄັບ login ໃຫ້ດ້ວຍ */
export async function currentViewer(): Promise<{ session: SessionPayload; viewer: KbViewer }> {
  const session = await requireUser();
  return { session, viewer: await viewerFrom(session) };
}

/** ໃຊ້ໃນໜ້າ/action ທີ່ຕ້ອງເປັນຜູ້ດູແລຄັງ — ບໍ່ມີສິດ ສົ່ງກັບໜ້າຫຼັກ */
export async function requireKbManager(): Promise<{ session: SessionPayload; viewer: KbViewer }> {
  const { session, viewer } = await currentViewer();
  if (!viewer.canManage) redirect("/dashboard?error=no_permission");
  return { session, viewer };
}

/** `where` ທີ່ຄຸມສະເພາະບົດທີ່ຜູ້ໃຊ້ຄົນນີ້ເປີດໄດ້ */
export function visibleArticleWhere(viewer: KbViewer): Prisma.KbArticleWhereInput {
  if (viewer.canManage) return {};

  const published: Prisma.KbArticleWhereInput = {
    status: "PUBLISHED",
    OR: [
      { visibility: "ALL" },
      { visibility: "ROLE", visibleRoles: { has: viewer.role } },
      {
        visibility: "DEPARTMENT",
        visibleDepartments: { has: viewer.departmentCode ?? NO_MATCH },
      },
    ],
  };

  return { OR: [published, { authorCode: viewer.employeeCode ?? NO_MATCH }] };
}

/**
 * ຄົ້ນຫາ — ILIKE ລ້ວນໆ ບໍ່ແມ່ນ full-text.
 *
 * ⚠ ຢ່າປ່ຽນເປັນ `to_tsvector`: DB ເປັນ PostgreSQL 11 ທີ່ **ບໍ່ມີ pg_trgm**
 * ແລະ ພາສາລາວບໍ່ມີຊ່ອງຫວ່າງລະຫວ່າງຄຳ ຈຶ່ງ tokenizer ຕັດຄຳບໍ່ໄດ້ —
 * `to_tsvector('simple', 'ນະໂຍບາຍລາພັກ')` ໄດ້ token ດຽວທັງປະໂຫຍກ,
 * ຄົ້ນຄຳຍ່ອຍຈະບໍ່ພົບ. ILIKE ຊ້າກວ່າແຕ່ຖືກຕ້ອງ ແລະ ດີພໍໃນລະດັບຫຼາຍພັນບົດ.
 */
export function searchWhere(q: string): Prisma.KbArticleWhereInput {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { summary: { contains: term, mode: "insensitive" } },
      { body: { contains: term, mode: "insensitive" } },
      { tags: { has: term } },
    ],
  };
}

export type KbListItem = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  tags: string[];
  status: string;
  version: number;
  requiresAck: boolean;
  updatedAt: Date;
  publishedAt: Date | null;
  categoryId: string | null;
  categoryName: string | null;
  attachmentCount: number;
  /** ຜູ້ໃຊ້ຄົນນີ້ຍັງບໍ່ໄດ້ຮັບຮູ້ຮຸ່ນປັດຈຸບັນ */
  ackPending: boolean;
};

export async function listArticles(
  viewer: KbViewer,
  opts: { q?: string; categoryId?: string; status?: string; tag?: string } = {},
): Promise<KbListItem[]> {
  const filters: Prisma.KbArticleWhereInput[] = [visibleArticleWhere(viewer)];
  if (opts.q) filters.push(searchWhere(opts.q));
  if (opts.categoryId) filters.push({ categoryId: opts.categoryId });
  if (opts.status) filters.push({ status: opts.status });
  if (opts.tag) filters.push({ tags: { has: opts.tag } });

  const rows = await prisma.kbArticle.findMany({
    where: { AND: filters },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      category: { select: { nameLo: true } },
      _count: { select: { attachments: true } },
      acks: {
        where: { employeeCode: viewer.employeeCode ?? NO_MATCH },
        select: { version: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    body: r.body,
    tags: r.tags,
    status: r.status,
    version: r.version,
    requiresAck: r.requiresAck,
    updatedAt: r.updatedAt,
    publishedAt: r.publishedAt,
    categoryId: r.categoryId,
    categoryName: r.category?.nameLo ?? null,
    attachmentCount: r._count.attachments,
    ackPending:
      r.requiresAck &&
      r.status === "PUBLISHED" &&
      !r.acks.some((a) => a.version === r.version),
  }));
}

/** ບົດດ່ຽວ + ໄຟລ໌ແນບ + ຮຸ່ນ — ຄືນ null ຖ້າບໍ່ມີ ຫຼື ບໍ່ມີສິດເປີດ */
export async function getArticle(id: string, viewer: KbViewer) {
  const article = await prisma.kbArticle.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, nameLo: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
      versions: { orderBy: { version: "desc" }, take: 20 },
    },
  });
  if (!article) return null;
  // ກວດຊ້ຳຝັ່ງເຊີບເວີ ເຖິງວ່າລາຍການຈະກອງໃຫ້ແລ້ວ — ໜ້ານີ້ເປີດດ້ວຍ id ໂດຍກົງໄດ້
  if (!canReadArticle(article, viewer)) return null;
  return article;
}

/** ຮຸ່ນທີ່ຜູ້ໃຊ້ຄົນນີ້ເຄີຍກົດຮັບຮູ້ແລ້ວ */
export async function ackedVersions(articleId: string, employeeCode: string | null): Promise<number[]> {
  if (!employeeCode) return [];
  const rows = await prisma.kbAcknowledgement.findMany({
    where: { articleId, employeeCode },
    select: { version: true },
  });
  return rows.map((r) => r.version);
}

/**
 * ໄຟລ໌ແນບນີ້ ຜູ້ໃຊ້ຄົນນີ້ໂຫຼດໄດ້ບໍ່ — ອີງສິດຂອງ**ບົດ**ທີ່ມັນຕິດຢູ່.
 * ໃຊ້ໃນ `/api/kb-file/[id]`.
 */
export async function attachmentForViewer(attachmentId: string, viewer: KbViewer) {
  const file = await prisma.kbAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      article: {
        select: {
          status: true,
          visibility: true,
          visibleDepartments: true,
          visibleRoles: true,
          authorCode: true,
        },
      },
    },
  });
  if (!file) return null;
  return canReadArticle(file.article, viewer) ? file : null;
}

/** ໝວດທັງໝົດ ພ້ອມຈຳນວນບົດທີ່ຜູ້ໃຊ້ຄົນນີ້ເຫັນ */
export async function listCategories(viewer: KbViewer) {
  const [categories, counts] = await Promise.all([
    prisma.kbCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { nameLo: "asc" }] }),
    prisma.kbArticle.groupBy({
      by: ["categoryId"],
      where: visibleArticleWhere(viewer),
      _count: { _all: true },
    }),
  ]);
  const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return categories.map((c) => ({ ...c, articleCount: countMap.get(c.id) ?? 0 }));
}

/**
 * ລາຍງານການຮັບຮູ້ຂອງ**ຮຸ່ນປັດຈຸບັນ**.
 *
 * ກຸ່ມເປົ້າໝາຍຄິດຈາກຂອບເຂດການເຫັນຂອງບົດ:
 *   ALL        → ພະນັກງານທີ່ຍັງເຮັດວຽກທັງໝົດ
 *   DEPARTMENT → ສະເພາະພະແນກທີ່ເລືອກ
 *   ROLE       → ພະນັກງານທີ່ບັນຊີຜູ້ໃຊ້ມີສິດນັ້ນ (ຄົນທີ່ຍັງບໍ່ມີບັນຊີ ຈຶ່ງບໍ່ຖືກນັບ)
 */
export async function ackReport(article: {
  id: string;
  version: number;
  visibility: string;
  visibleDepartments: string[];
  visibleRoles: string[];
}) {
  const where =
    article.visibility === "DEPARTMENT"
      ? { ...ACTIVE_EMPLOYEE, departmentCode: { in: article.visibleDepartments } }
      : article.visibility === "ROLE"
        ? { ...ACTIVE_EMPLOYEE, user: { is: { role: { in: article.visibleRoles as never } } } }
        : ACTIVE_EMPLOYEE;

  const [audience, acks] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: { code: true, fullnameLo: true },
      orderBy: { code: "asc" },
    }),
    prisma.kbAcknowledgement.findMany({
      where: { articleId: article.id, version: article.version },
      select: { employeeCode: true, ackedAt: true },
    }),
  ]);

  const ackedAt = new Map(acks.map((a) => [a.employeeCode, a.ackedAt]));
  const done = audience.filter((e) => ackedAt.has(e.code));
  const waiting = audience.filter((e) => !ackedAt.has(e.code));

  return {
    total: audience.length,
    done: done.map((e) => ({ ...e, ackedAt: ackedAt.get(e.code)! })),
    waiting,
    /** ຄົນທີ່ກົດຮັບຮູ້ ແຕ່ບໍ່ຢູ່ໃນກຸ່ມເປົ້າໝາຍແລ້ວ (ຍ້າຍພະແນກ / ລາອອກ) */
    outsideAudience: acks.length - done.length,
  };
}

/**
 * ຈຳນວນບົດທີ່ຄົນນີ້ຍັງຕ້ອງກົດຮັບຮູ້ — ໃຊ້ເປັນປ້າຍແຈ້ງເຕືອນໃນແອັບພະນັກງານ.
 * ດຶງແຕ່ id/version ຈຶ່ງເບົາພໍທີ່ຈະເອີ້ນທຸກຄັ້ງທີ່ເປີດແອັບ.
 */
export async function pendingAckCount(viewer: KbViewer): Promise<number> {
  if (!viewer.employeeCode) return 0;
  const rows = await prisma.kbArticle.findMany({
    where: { AND: [visibleArticleWhere(viewer), { requiresAck: true, status: "PUBLISHED" }] },
    select: {
      version: true,
      acks: { where: { employeeCode: viewer.employeeCode }, select: { version: true } },
    },
  });
  return rows.filter((r) => !r.acks.some((a) => a.version === r.version)).length;
}
