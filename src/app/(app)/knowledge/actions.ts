"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentViewer, getArticle, requireKbManager } from "@/lib/kb-access";
import { deleteKbFile, saveKbFile } from "@/lib/kb-storage";
import { isKbVisibility, parseTags } from "@/lib/knowledge";
import { ROLES } from "@/lib/menu";

/**
 * ຄຳສັ່ງທັງໝົດຂອງຄັງຄວາມຮູ້.
 *
 * ວົງຈອນ: ຮ່າງ → ສົ່ງອະນຸມັດ → ເຜີຍແຜ່ (ຫຼື ຕີກັບ) → ເກັບເຂົ້າຄັງ.
 * ຜູ້ດູແລຄັງເຜີຍແຜ່ໂດຍກົງໄດ້ ບໍ່ຕ້ອງຜ່ານ "ລໍອະນຸມັດ".
 *
 * ⚠ **ເລກຮຸ່ນ**: ບັນທຶກທຸກຄັ້ງທີ່ຫົວຂໍ້/ບົດຫຍໍ້/ເນື້ອໃນປ່ຽນ ຈະ +1 ແລ້ວເກັບ
 * ພາບຖ່າຍລົງ `hrm_kb_article_version`. ການຮັບຮູ້ຜູກກັບເລກຮຸ່ນ ຈຶ່ງແກ້ນະໂຍບາຍແລ້ວ
 * ພະນັກງານຕ້ອງກັບມາກົດຮັບຮູ້ໃໝ່ໂດຍອັດຕະໂນມັດ — ຢ່າແກ້ໃຫ້ບໍ່ບວກຮຸ່ນ.
 */

export type KbFormState = { error?: string; success?: string };

const articleSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1),
  categoryId: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  visibility: z.string().trim().default("ALL"),
  requiresAck: z.coerce.boolean().optional(),
  changeNote: z.string().trim().max(300).optional(),
});

function readVisibility(formData: FormData, raw: string) {
  const visibility = isKbVisibility(raw) ? raw : "ALL";
  const departments =
    visibility === "DEPARTMENT"
      ? formData.getAll("visibleDepartments").map(String).filter(Boolean)
      : [];
  const roles =
    visibility === "ROLE"
      ? formData
          .getAll("visibleRoles")
          .map(String)
          .filter((r) => (ROLES as readonly string[]).includes(r))
      : [];
  return { visibility, departments, roles };
}

/**
 * ລ້າງ cache ຂອງໜ້າຄັງຄວາມຮູ້ທັງໝົດ.
 *
 * ⚠ ອັນນີ້ລ້າງ cache ຢ່າງດຽວ — **ບໍ່**ພຽງພໍທີ່ຈະໃຫ້ໜ້າທີ່ຜູ້ໃຊ້ກຳລັງເປີດຢູ່
 * ສະແດງຂໍ້ມູນໃໝ່. ທຸກ action ຈຶ່ງຈົບດ້ວຍ `redirect()` ກັບໄປໜ້າເດີມ (POST→redirect→GET).
 *
 * ເປັນຫຍັງ: ທົດສອບ 2026-09-01 ພົບວ່າ ກົດ "ເຜີຍແຜ່" ແລ້ວ DB ປ່ຽນຈິງ ແຕ່ໜ້າຈໍຄ້າງ
 * ສະຖານະເກົ່າ. ທັງ `revalidatePath` ແລະ `refresh()` (ໃໝ່ໃນ Next 16) ໃຫ້ຜົນບໍ່ແນ່ນອນ
 * — ບາງເທື່ອອັບເດດ ບາງເທື່ອບໍ່. `force-dynamic` ກໍຊ່ວຍບໍ່ໄດ້.
 * redirect ບັງຄັບໃຫ້ navigate ໃໝ່ ຈຶ່ງເຫັນຜົນທຸກເທື່ອ. ຢ່າຖອດອອກ.
 */
function revalidateKb(id?: string) {
  revalidatePath("/knowledge");
  revalidatePath("/knowledge/manage");
  if (id) {
    revalidatePath(`/knowledge/${id}`);
    revalidatePath(`/knowledge/manage/${id}`);
  }
}

export async function createArticle(
  _previous: KbFormState,
  formData: FormData,
): Promise<KbFormState> {
  const { session } = await requireKbManager();
  const parsed = articleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາໃສ່ຫົວຂໍ້ ແລະ ເນື້ອໃນ" };
  const v = parsed.data;
  const { visibility, departments, roles } = readVisibility(formData, v.visibility);
  if (visibility === "DEPARTMENT" && departments.length === 0) {
    return { error: "ເລືອກຢ່າງໜ້ອຍ 1 ພະແນກ ຫຼື ປ່ຽນເປັນ ‘ທຸກຄົນ’" };
  }
  if (visibility === "ROLE" && roles.length === 0) {
    return { error: "ເລືອກຢ່າງໜ້ອຍ 1 ສິດ ຫຼື ປ່ຽນເປັນ ‘ທຸກຄົນ’" };
  }

  const article = await prisma.kbArticle.create({
    data: {
      title: v.title,
      summary: v.summary || null,
      body: v.body,
      categoryId: v.categoryId || null,
      tags: parseTags(v.tags),
      visibility,
      visibleDepartments: departments,
      visibleRoles: roles,
      requiresAck: !!v.requiresAck,
      status: "DRAFT",
      version: 1,
      authorCode: session.employeeCode,
      updatedBy: session.userId,
      versions: {
        create: {
          version: 1,
          title: v.title,
          summary: v.summary || null,
          body: v.body,
          note: "ສ້າງບົດ",
          changedBy: session.userId,
        },
      },
    },
  });

  revalidateKb();
  redirect(`/knowledge/manage/${article.id}?saved=new`);
}

export async function updateArticle(
  _previous: KbFormState,
  formData: FormData,
): Promise<KbFormState> {
  const { session } = await requireKbManager();
  const id = String(formData.get("id") ?? "");
  const parsed = articleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!id || !parsed.success) return { error: "ກະລຸນາໃສ່ຫົວຂໍ້ ແລະ ເນື້ອໃນ" };
  const v = parsed.data;
  const { visibility, departments, roles } = readVisibility(formData, v.visibility);
  if (visibility === "DEPARTMENT" && departments.length === 0) {
    return { error: "ເລືອກຢ່າງໜ້ອຍ 1 ພະແນກ ຫຼື ປ່ຽນເປັນ ‘ທຸກຄົນ’" };
  }
  if (visibility === "ROLE" && roles.length === 0) {
    return { error: "ເລືອກຢ່າງໜ້ອຍ 1 ສິດ ຫຼື ປ່ຽນເປັນ ‘ທຸກຄົນ’" };
  }

  const current = await prisma.kbArticle.findUnique({ where: { id } });
  if (!current) return { error: "ບໍ່ພົບບົດນີ້" };

  // ປ່ຽນສະເພາະແທັກ/ຂອບເຂດການເຫັນ ບໍ່ນັບເປັນຮຸ່ນໃໝ່ — ບໍ່ຄວນບັງຄັບໃຫ້ຮັບຮູ້ຄືນ
  const contentChanged =
    current.title !== v.title ||
    (current.summary ?? "") !== (v.summary ?? "") ||
    current.body !== v.body;
  const version = contentChanged ? current.version + 1 : current.version;

  await prisma.kbArticle.update({
    where: { id },
    data: {
      title: v.title,
      summary: v.summary || null,
      body: v.body,
      categoryId: v.categoryId || null,
      tags: parseTags(v.tags),
      visibility,
      visibleDepartments: departments,
      visibleRoles: roles,
      requiresAck: !!v.requiresAck,
      version,
      updatedBy: session.userId,
      ...(contentChanged
        ? {
            versions: {
              create: {
                version,
                title: v.title,
                summary: v.summary || null,
                body: v.body,
                note: v.changeNote || null,
                changedBy: session.userId,
              },
            },
          }
        : {}),
    },
  });

  revalidateKb(id);
  // ບອກຜົນຜ່ານ query ແທນ useActionState — redirect ຈະລ້າງ state ຂອງຟອມຢູ່ແລ້ວ
  redirect(`/knowledge/manage/${id}?saved=${contentChanged ? `v${version}` : "same"}`);
}

/** ປ່ຽນສະຖານະ — ໃຊ້ຮ່ວມກັນສຳລັບ ສົ່ງອະນຸມັດ / ເຜີຍແຜ່ / ຕີກັບ / ເກັບເຂົ້າຄັງ */
export async function changeArticleStatus(formData: FormData): Promise<void> {
  const { session } = await requireKbManager();
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return;

  const data: Record<string, unknown> = { updatedBy: session.userId };
  switch (to) {
    case "PENDING":
      data.status = "PENDING";
      data.rejectReason = null;
      break;
    case "PUBLISHED":
      data.status = "PUBLISHED";
      data.publishedAt = new Date();
      data.publishedBy = session.userId;
      data.rejectReason = null;
      break;
    case "DRAFT":
      data.status = "DRAFT";
      data.rejectReason = reason || null;
      break;
    case "ARCHIVED":
      data.status = "ARCHIVED";
      break;
    default:
      return;
  }

  await prisma.kbArticle.update({ where: { id }, data });
  revalidateKb(id);
  // ⚠ ຕ້ອງມີ query ບອກສະຖານະໃໝ່ — redirect ໄປ URL **ດຽວກັນກັບທີ່ຢືນຢູ່** ບໍ່ເກີດ
  // navigation ຈຶ່ງໜ້າຈໍບໍ່ອັບເດດ (ພົບຕອນ test: ສົ່ງອະນຸມັດ→ເຜີຍແຜ່ ຕິດກັນ)
  redirect(`/knowledge/manage/${id}?saved=${to}`);
}

export async function deleteArticle(formData: FormData): Promise<void> {
  await requireKbManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // ໄຟລ໌ຢູ່ນອກ DB ຈຶ່ງ cascade ລຶບໃຫ້ບໍ່ໄດ້ — ຕ້ອງເກັບກວາດເອງກ່ອນ
  const files = await prisma.kbAttachment.findMany({
    where: { articleId: id },
    select: { storedName: true },
  });
  await prisma.kbArticle.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteKbFile(f.storedName)));

  revalidateKb();
  redirect("/knowledge/manage");
}

export async function addAttachment(
  _previous: KbFormState,
  formData: FormData,
): Promise<KbFormState> {
  const { session } = await requireKbManager();
  const articleId = String(formData.get("articleId") ?? "");
  const file = formData.get("file");
  if (!articleId || !(file instanceof File)) return { error: "ຍັງບໍ່ໄດ້ເລືອກໄຟລ໌" };

  const saved = await saveKbFile(file);
  if ("error" in saved) {
    const message = {
      bad_type: "ຮູບແບບໄຟລ໌ນີ້ບໍ່ຮອງຮັບ",
      too_large: "ໄຟລ໌ໃຫຍ່ເກີນ 20MB",
      no_file: "ຍັງບໍ່ໄດ້ເລືອກໄຟລ໌",
    }[saved.error];
    return { error: message };
  }

  await prisma.kbAttachment.create({
    data: {
      articleId,
      name: saved.name,
      storedName: saved.storedName,
      mime: saved.mime,
      sizeBytes: saved.sizeBytes,
      uploadedBy: session.userId,
    },
  });

  revalidateKb(articleId);
  redirect(`/knowledge/manage/${articleId}?saved=file`);
}

export async function removeAttachment(formData: FormData): Promise<void> {
  await requireKbManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const file = await prisma.kbAttachment.findUnique({ where: { id } });
  if (!file) return;
  await prisma.kbAttachment.delete({ where: { id } });
  await deleteKbFile(file.storedName);

  revalidateKb(file.articleId);
  redirect(`/knowledge/manage/${file.articleId}`);
}

/**
 * ພະນັກງານກົດ "ຮັບຮູ້".
 *
 * ບັນທຶກຄູ່ກັບ**ຮຸ່ນທີ່ອ່ານ** ຈຶ່ງພິສູດໄດ້ວ່າຮັບຮູ້ເນື້ອໃນສະບັບໃດ.
 * ກົດຊ້ຳບໍ່ເປັນຫຍັງ (PK ຮ່ວມ + skipDuplicates).
 */
export async function acknowledgeArticle(formData: FormData): Promise<void> {
  const { viewer } = await currentViewer();
  const id = String(formData.get("id") ?? "");
  if (!id || !viewer.employeeCode) return;

  const article = await getArticle(id, viewer);
  if (!article || article.status !== "PUBLISHED" || !article.requiresAck) return;

  await prisma.kbAcknowledgement.createMany({
    data: [{ articleId: id, employeeCode: viewer.employeeCode, version: article.version }],
    skipDuplicates: true,
  });

  revalidateKb(id);
  redirect(`/knowledge/${id}`);
}

const categorySchema = z.object({
  nameLo: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export async function createCategory(
  _previous: KbFormState,
  formData: FormData,
): Promise<KbFormState> {
  await requireKbManager();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາໃສ່ຊື່ໝວດ" };

  await prisma.kbCategory.create({
    data: { nameLo: parsed.data.nameLo, sortOrder: parsed.data.sortOrder ?? 0 },
  });
  revalidateKb();
  redirect("/knowledge/manage?saved=category");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireKbManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // FK ເປັນ SET NULL — ບົດໃນໝວດນີ້ບໍ່ຫາຍ ພຽງແຕ່ກາຍເປັນ "ບໍ່ມີໝວດ"
  await prisma.kbCategory.delete({ where: { id } }).catch(() => {});
  revalidateKb();
  redirect("/knowledge/manage");
}
