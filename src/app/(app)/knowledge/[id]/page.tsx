import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { ackedVersions, currentViewer, getArticle } from "@/lib/kb-access";
import { KB_STATUS_LABEL, KB_STATUS_TONE, needsAck, type KbStatus } from "@/lib/knowledge";
import { formatSize, isInlineViewable } from "@/lib/kb-storage";
import { renderMarkdown } from "@/lib/markdown";
import { laoDate, laoDateTime } from "@/lib/format";
import { acknowledgeArticle } from "../actions";

export const dynamic = "force-dynamic";

/** ອ່ານບົດ. ຮຸ່ນເກົ່າເປີດເບິ່ງໄດ້ດ້ວຍ `?v=<ເລກຮຸ່ນ>` */
export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;
  const { viewer } = await currentViewer();

  const article = await getArticle(id, viewer);
  if (!article) notFound();

  const acked = await ackedVersions(article.id, viewer.employeeCode);
  const mustAck = needsAck(article, acked);

  const author = article.authorCode
    ? await prisma.employee.findUnique({
        where: { code: article.authorCode },
        select: { fullnameLo: true },
      })
    : null;

  // ເບິ່ງຮຸ່ນເກົ່າ — ຖ້າຂໍຮຸ່ນທີ່ບໍ່ມີ ໃຫ້ຕົກກັບເນື້ອໃນປັດຈຸບັນ
  const wanted = v ? Number(v) : null;
  const oldVersion =
    wanted && wanted !== article.version
      ? article.versions.find((ver) => ver.version === wanted) ?? null
      : null;
  const shown = oldVersion ?? article;

  return (
    <>
      <PageHeader
        title={shown.title}
        subtitle={article.summary ?? undefined}
        action={
          viewer.canManage ? (
            <LinkButton href={`/knowledge/manage/${article.id}`} variant="ghost">
              ແກ້ໄຂ
            </LinkButton>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <Badge tone={KB_STATUS_TONE[article.status as KbStatus]}>
          {KB_STATUS_LABEL[article.status as KbStatus]}
        </Badge>
        {article.category && <span>ໝວດ: {article.category.nameLo}</span>}
        <span>ຮຸ່ນປັດຈຸບັນ {article.version}</span>
        {author && <span>ຜູ້ຂຽນ: {author.fullnameLo}</span>}
        {article.publishedAt && <span>ເຜີຍແຜ່ {laoDate(article.publishedAt)}</span>}
        <span>ອັບເດດ {laoDateTime(article.updatedAt)}</span>
      </div>

      {article.tags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {article.tags.map((t) => (
            <Link
              key={t}
              href={`/knowledge?tag=${encodeURIComponent(t)}`}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 transition hover:bg-slate-200"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {oldVersion && (
        <Card className="mb-5 border-blue-300 bg-blue-50">
          <p className="text-sm text-blue-800">
            ກຳລັງເບິ່ງ <strong>ຮຸ່ນ {oldVersion.version}</strong> ({laoDateTime(oldVersion.changedAt)})
            {oldVersion.note ? ` — ${oldVersion.note}` : ""}.{" "}
            <Link href={`/knowledge/${article.id}`} className="underline underline-offset-2">
              ກັບໄປຮຸ່ນປັດຈຸບັນ
            </Link>
          </p>
        </Card>
      )}

      {mustAck && !oldVersion && (
        <Card className="mb-5 border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">
            ບົດນີ້ຕ້ອງກົດຮັບຮູ້ຫຼັງອ່ານຈົບ
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {acked.length > 0
              ? `ທ່ານເຄີຍຮັບຮູ້ຮຸ່ນ ${acked.join(", ")} ແລ້ວ ແຕ່ບົດຖືກປັບປຸງເປັນຮຸ່ນ ${article.version}`
              : "ການຮັບຮູ້ຈະບັນທຶກຄູ່ກັບເລກຮຸ່ນ ແລະ ວັນເວລາ"}
          </p>
          {viewer.employeeCode ? (
            <form action={acknowledgeArticle} className="mt-3">
              <input type="hidden" name="id" value={article.id} />
              <button className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110">
                ຮັບຮູ້ຮຸ່ນ {article.version}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-amber-800">
              ບັນຊີນີ້ຍັງບໍ່ໄດ້ຜູກກັບລະຫັດພະນັກງານ ຈຶ່ງບັນທຶກການຮັບຮູ້ບໍ່ໄດ້
            </p>
          )}
        </Card>
      )}

      {article.requiresAck && !mustAck && !oldVersion && (
        <Card className="mb-5 border-emerald-300 bg-emerald-50">
          <p className="text-sm text-emerald-800">ທ່ານຮັບຮູ້ຮຸ່ນ {article.version} ແລ້ວ</p>
        </Card>
      )}

      <Card>
        <div
          className="kb-prose"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(shown.body) }}
        />
      </Card>

      {article.attachments.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">ໄຟລ໌ແນບ</h2>
          <ul className="space-y-2 text-sm">
            {article.attachments.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3">
                <a
                  href={`/api/kb-file/${f.id}${isInlineViewable(f.mime) ? "" : "?download=1"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {f.name}
                </a>
                <span className="text-xs text-muted">{formatSize(f.sizeBytes)}</span>
                {isInlineViewable(f.mime) && (
                  <a
                    href={`/api/kb-file/${f.id}?download=1`}
                    className="text-xs text-muted underline underline-offset-2"
                  >
                    ດາວໂຫຼດ
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {article.versions.length > 1 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">ປະຫວັດການປັບປຸງ</h2>
          <ul className="space-y-2 text-sm">
            {article.versions.map((ver) => (
              <li key={ver.id} className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/knowledge/${article.id}?v=${ver.version}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  ຮຸ່ນ {ver.version}
                </Link>
                <span className="text-xs text-muted">{laoDateTime(ver.changedAt)}</span>
                {ver.note && <span className="text-xs text-muted">{ver.note}</span>}
                {ver.version === article.version && <Badge tone="green">ປັດຈຸບັນ</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
