import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { ackedVersions, employeeViewer, getArticle, listArticles, listCategories } from "@/lib/kb-access";
import { needsAck } from "@/lib/knowledge";
import { excerpt } from "@/lib/markdown";
import { formatSize, isInlineViewable } from "@/lib/kb-storage";

/**
 * ຄັງຄວາມຮູ້ ສຳລັບແອັບພະນັກງານ (LINE mini-app ຫຼື portal).
 *
 * ອ່ານຢ່າງດຽວ + ກົດຮັບຮູ້ — ບໍ່ມີການສ້າງ/ແກ້ (ອັນນັ້ນຢູ່ເວັບ HRM `/knowledge/manage`).
 * ຂອບເຂດການເຫັນໃຊ້ກົດອັນດຽວກັນກັບເວັບ (`kb-access.ts` → `knowledge.ts`).
 *
 * ⚠ ໄຟລ໌ແນບ: ສົ່ງແຕ່ລິ້ງ `/api/kb-file/<id>` ເຊິ່ງ **ຕ້ອງມີ session cookie ຂອງ HRM**.
 * ຄົນທີ່ເຂົ້າຜ່ານ LINE ຈະບໍ່ມີ cookie ນັ້ນ ຈຶ່ງສົ່ງ `canDownload: false` ໄປໃຫ້ UI
 * ບອກໃຫ້ເປີດຜ່ານເວັບ HRM ແທນ ແທນທີ່ຈະໃຫ້ກົດແລ້ວໄດ້ 401.
 */

const schema = z.object({
  idToken: z.string().min(1).optional(),
  action: z.enum(["list", "read", "ack"]).default("list"),
  id: z.string().trim().max(50).optional(),
  q: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().max(50).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const value = parsed.data;

  const auth = await getRequestEmployee(value.idToken);
  if (auth.kind === "unauthenticated") return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  if (auth.kind !== "employee") return NextResponse.json({ error: "employee_not_linked" }, { status: 403 });

  const viewer = employeeViewer(auth.employee, auth.actorRole);
  // ຜ່ານ LINE ບໍ່ມີ cookie ຂອງ HRM → ໂຫຼດໄຟລ໌ແນບບໍ່ໄດ້
  const canDownload = !value.idToken;

  if (value.action === "read") {
    if (!value.id) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    const article = await getArticle(value.id, viewer);
    if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const acked = await ackedVersions(article.id, viewer.employeeCode);
    return NextResponse.json({
      id: article.id,
      title: article.title,
      summary: article.summary,
      body: article.body,
      tags: article.tags,
      version: article.version,
      category: article.category?.nameLo ?? null,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      requiresAck: article.requiresAck,
      needsAck: needsAck(article, acked),
      ackedVersion: acked.length > 0 ? Math.max(...acked) : null,
      canDownload,
      attachments: article.attachments.map((f) => ({
        id: f.id,
        name: f.name,
        size: formatSize(f.sizeBytes),
        url: `/api/kb-file/${f.id}${isInlineViewable(f.mime) ? "" : "?download=1"}`,
      })),
    });
  }

  if (value.action === "ack") {
    if (!value.id) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    const article = await getArticle(value.id, viewer);
    if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (article.status !== "PUBLISHED" || !article.requiresAck) {
      return NextResponse.json({ error: "ack_not_required" }, { status: 400 });
    }

    // ກົດຊ້ຳບໍ່ເປັນຫຍັງ — PK ຮ່ວມ (ບົດ+ຄົນ+ຮຸ່ນ) ກັນຊ້ຳໃຫ້ແລ້ວ
    await prisma.kbAcknowledgement.createMany({
      data: [{ articleId: article.id, employeeCode: auth.employee.code, version: article.version }],
      skipDuplicates: true,
    });
    return NextResponse.json({ ok: true, version: article.version });
  }

  const [articles, categories] = await Promise.all([
    listArticles(viewer, { q: value.q, categoryId: value.categoryId }),
    listCategories(viewer),
  ]);

  // ບົດທີ່ຍັງຕ້ອງຮັບຮູ້ ຂຶ້ນກ່ອນສະເໝີ — ນັ້ນຄືສິ່ງທີ່ພະນັກງານຕ້ອງເຮັດ
  const sorted = [...articles].sort((a, b) => Number(b.ackPending) - Number(a.ackPending));

  return NextResponse.json({
    articles: sorted.slice(0, 50).map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: a.summary || excerpt(a.body, 120),
      category: a.categoryName,
      tags: a.tags,
      version: a.version,
      attachmentCount: a.attachmentCount,
      updatedAt: a.publishedAt ?? a.updatedAt,
      ackPending: a.ackPending,
    })),
    categories: categories
      .filter((c) => c.articleCount > 0)
      .map((c) => ({ id: c.id, name: c.nameLo, count: c.articleCount })),
    total: articles.length,
  });
}
