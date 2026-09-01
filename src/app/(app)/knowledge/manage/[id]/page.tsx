import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { ackReport, getArticle, requireKbManager } from "@/lib/kb-access";
import { KB_STATUS_LABEL, KB_STATUS_TONE, type KbStatus } from "@/lib/knowledge";
import { KB_ACCEPT, KB_MAX_MB, formatSize } from "@/lib/kb-storage";
import { laoDateTime } from "@/lib/format";
import { changeArticleStatus, deleteArticle, removeAttachment } from "../../actions";
import { ArticleForm } from "../article-form";
import { AttachmentForm } from "./attachment-form";

export const dynamic = "force-dynamic";

/** ປຸ່ມປ່ຽນສະຖານະ — ຟອມນ້ອຍໆ ຕໍ່ 1 ປຸ່ມ ຈຶ່ງບໍ່ຕ້ອງມີ client component */
function StatusButton({
  id,
  to,
  label,
  tone = "ghost",
}: {
  id: string;
  to: string;
  label: string;
  tone?: "primary" | "ghost" | "danger";
}) {
  const cls = {
    primary: "bg-primary text-white hover:bg-[#5d3e55]",
    ghost: "border border-border bg-card hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:brightness-110",
  }[tone];
  return (
    <form action={changeArticleStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button className={`rounded-md px-4 py-2 text-sm font-medium shadow-sm transition ${cls}`}>
        {label}
      </button>
    </form>
  );
}

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { viewer } = await requireKbManager();

  const article = await getArticle(id, viewer);
  if (!article) notFound();

  const [categories, departments, report] = await Promise.all([
    prisma.kbCategory.findMany({
      select: { id: true, nameLo: true },
      orderBy: [{ sortOrder: "asc" }, { nameLo: "asc" }],
    }),
    prisma.department.findMany({ select: { code: true, nameLo: true }, orderBy: { code: "asc" } }),
    article.requiresAck ? ackReport(article) : null,
  ]);

  const status = article.status as KbStatus;

  // ຂໍ້ຄວາມຜົນລັບມາທາງ query ເພາະທຸກ action ຈົບດ້ວຍ redirect (ເບິ່ງ actions.ts)
  const SAVED_MESSAGE: Record<string, string> = {
    new: "ສ້າງບົດແລ້ວ — ຍັງເປັນຮ່າງ ຈົນກວ່າຈະກົດເຜີຍແຜ່",
    same: "ບັນທຶກແລ້ວ",
    file: "ແນບໄຟລ໌ແລ້ວ",
    PENDING: "ສົ່ງໄປອະນຸມັດແລ້ວ",
    PUBLISHED: "ເຜີຍແຜ່ແລ້ວ",
    DRAFT: "ຖອນກັບເປັນຮ່າງແລ້ວ",
    ARCHIVED: "ເກັບເຂົ້າຄັງແລ້ວ",
  };
  const savedMessage =
    (saved && SAVED_MESSAGE[saved]) ??
    (saved?.startsWith("v") ? `ບັນທຶກແລ້ວ — ກາຍເປັນຮຸ່ນ ${saved.slice(1)}` : null);

  return (
    <>
      <PageHeader
        title="ແກ້ໄຂບົດ"
        subtitle={article.title}
        action={
          <LinkButton href={`/knowledge/${article.id}`} variant="ghost">
            ເບິ່ງໜ້າອ່ານ
          </LinkButton>
        }
      />

      {savedMessage && (
        <p className="mb-5 rounded-md bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {savedMessage}
        </p>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={KB_STATUS_TONE[status]}>{KB_STATUS_LABEL[status]}</Badge>
          <span className="text-sm text-muted">ຮຸ່ນ {article.version}</span>
          {article.publishedAt && (
            <span className="text-sm text-muted">ເຜີຍແຜ່ {laoDateTime(article.publishedAt)}</span>
          )}
        </div>

        {article.rejectReason && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            ຖືກຕີກັບ: {article.rejectReason}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {status === "DRAFT" && (
            <>
              <StatusButton id={article.id} to="PENDING" label="ສົ່ງອະນຸມັດ" />
              <StatusButton id={article.id} to="PUBLISHED" label="ເຜີຍແຜ່ເລີຍ" tone="primary" />
            </>
          )}
          {status === "PENDING" && (
            <>
              <StatusButton id={article.id} to="PUBLISHED" label="ອະນຸມັດ ແລະ ເຜີຍແຜ່" tone="primary" />
              <StatusButton id={article.id} to="DRAFT" label="ຕີກັບເປັນຮ່າງ" />
            </>
          )}
          {status === "PUBLISHED" && (
            <>
              <StatusButton id={article.id} to="DRAFT" label="ຖອນກັບເປັນຮ່າງ" />
              <StatusButton id={article.id} to="ARCHIVED" label="ເກັບເຂົ້າຄັງ" />
            </>
          )}
          {status === "ARCHIVED" && (
            <StatusButton id={article.id} to="PUBLISHED" label="ນຳກັບມາເຜີຍແຜ່" tone="primary" />
          )}

          <form action={deleteArticle} className="ml-auto">
            <input type="hidden" name="id" value={article.id} />
            <button className="rounded-md px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
              ລຶບບົດນີ້
            </button>
          </form>
        </div>
      </Card>

      <ArticleForm article={article} categories={categories} departments={departments} />

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">ໄຟລ໌ແນບ</h2>
        {article.attachments.length > 0 && (
          <ul className="mb-4 divide-y divide-border border-y border-border">
            {article.attachments.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <a
                    href={`/api/kb-file/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {f.name}
                  </a>
                  <span className="ml-2 text-xs text-muted">{formatSize(f.sizeBytes)}</span>
                </span>
                <form action={removeAttachment}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="text-xs text-rose-600 underline underline-offset-2">ລຶບ</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AttachmentForm articleId={article.id} accept={KB_ACCEPT} maxMb={KB_MAX_MB} />
      </Card>

      {report && (
        <Card className="mt-6">
          <h2 className="mb-1 text-sm font-semibold">ການຮັບຮູ້ (ຮຸ່ນ {article.version})</h2>
          <p className="mb-4 text-sm text-muted">
            ຮັບຮູ້ແລ້ວ {report.done.length} / {report.total} ຄົນ
            {report.outsideAudience > 0 && ` (+${report.outsideAudience} ຄົນນອກກຸ່ມເປົ້າໝາຍປັດຈຸບັນ)`}
          </p>

          {report.waiting.length === 0 ? (
            <p className="text-sm text-emerald-700">ຮັບຮູ້ຄົບທຸກຄົນແລ້ວ</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium">ຍັງບໍ່ໄດ້ຮັບຮູ້ ({report.waiting.length})</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {report.waiting.slice(0, 60).map((e) => (
                  <li key={e.code}>{e.fullnameLo}</li>
                ))}
              </ul>
              {report.waiting.length > 60 && (
                <p className="mt-2 text-xs text-muted">
                  ສະແດງ 60 ຄົນທຳອິດ ຈາກ {report.waiting.length} ຄົນ
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {article.versions.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">ປະຫວັດການປັບປຸງ</h2>
          <ul className="space-y-2 text-sm">
            {article.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/knowledge/${article.id}?v=${v.version}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  ຮຸ່ນ {v.version}
                </Link>
                <span className="text-xs text-muted">{laoDateTime(v.changedAt)}</span>
                {v.note && <span className="text-xs text-muted">{v.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
