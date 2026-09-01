import Link from "next/link";
import { Badge, Card, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { currentViewer, listArticles, listCategories } from "@/lib/kb-access";
import { KB_STATUS_LABEL, KB_STATUS_TONE, type KbStatus } from "@/lib/knowledge";
import { excerpt } from "@/lib/markdown";
import { laoDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * ຄັງຄວາມຮູ້ — ລາຍການບົດທີ່ຜູ້ໃຊ້ຄົນນີ້ເປີດໄດ້.
 *
 * ພະນັກງານທົ່ວໄປເຫັນສະເພາະບົດທີ່ເຜີຍແຜ່ແລ້ວ ແລະ ຢູ່ໃນຂອບເຂດຂອງຕົນ;
 * ຜູ້ດູແລຄັງເຫັນຮ່າງນຳ (ກອງດ້ວຍ `visibleArticleWhere`).
 * ຄົ້ນຫາເປັນ ILIKE — ເຫດຜົນຢູ່ `kb-access.ts`.
 */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; tag?: string }>;
}) {
  const { viewer } = await currentViewer();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const [articles, categories] = await Promise.all([
    listArticles(viewer, { q, categoryId: sp.cat, tag: sp.tag }),
    listCategories(viewer),
  ]);

  const pending = articles.filter((a) => a.ackPending);

  return (
    <>
      <PageHeader
        title="ຄັງຄວາມຮູ້"
        subtitle="ຄູ່ມືວຽກ, ນະໂຍບາຍ ແລະ ຂັ້ນຕອນປະຕິບັດງານຂອງບໍລິສັດ"
        action={viewer.canManage ? <LinkButton href="/knowledge/manage">ຈັດການຄັງ</LinkButton> : undefined}
      />

      {pending.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">
            ມີ {pending.length} ບົດທີ່ຕ້ອງອ່ານ ແລະ ກົດຮັບຮູ້
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {pending.map((a) => (
              <li key={a.id}>
                <Link href={`/knowledge/${a.id}`} className="text-primary underline underline-offset-2">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ຄົ້ນຫາຫົວຂໍ້ ຫຼື ເນື້ອໃນ…"
          className={`${inputClass} max-w-md flex-1`}
        />
        <select name="cat" defaultValue={sp.cat ?? ""} className={`${inputClass} max-w-56`}>
          <option value="">ທຸກໝວດ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameLo} ({c.articleCount})
            </option>
          ))}
        </select>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55]">
          ຄົ້ນຫາ
        </button>
        {(q || sp.cat || sp.tag) && (
          <Link
            href="/knowledge"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm transition hover:bg-slate-50"
          >
            ລ້າງ
          </Link>
        )}
      </form>

      {sp.tag && (
        <p className="mb-4 text-sm text-muted">
          ກອງດ້ວຍແທັກ <span className="font-medium text-foreground">{sp.tag}</span>
        </p>
      )}

      {articles.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">
            {q || sp.cat || sp.tag ? "ບໍ່ພົບບົດທີ່ກົງກັບເງື່ອນໄຂ" : "ຍັງບໍ່ມີບົດໃນຄັງ"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Card key={a.id} className="transition hover:border-primary/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/knowledge/${a.id}`} className="text-base font-semibold hover:underline">
                    {a.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">{a.summary || excerpt(a.body)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {a.ackPending && <Badge tone="amber">ຕ້ອງຮັບຮູ້</Badge>}
                  {a.status !== "PUBLISHED" && (
                    <Badge tone={KB_STATUS_TONE[a.status as KbStatus]}>
                      {KB_STATUS_LABEL[a.status as KbStatus]}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                {a.categoryName && <span>ໝວດ: {a.categoryName}</span>}
                <span>ຮຸ່ນ {a.version}</span>
                {a.attachmentCount > 0 && <span>ໄຟລ໌ແນບ {a.attachmentCount}</span>}
                <span>ອັບເດດ {laoDate(a.publishedAt ?? a.updatedAt)}</span>
                {a.tags.map((t) => (
                  <Link key={t} href={`/knowledge?tag=${encodeURIComponent(t)}`} className="hover:underline">
                    #{t}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
