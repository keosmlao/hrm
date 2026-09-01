import Link from "next/link";
import { Badge, Card, EmptyRow, LinkButton, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { listArticles, listCategories, requireKbManager } from "@/lib/kb-access";
import { KB_STATUSES, KB_STATUS_LABEL, KB_STATUS_TONE, type KbStatus } from "@/lib/knowledge";
import { laoDate } from "@/lib/format";
import { deleteCategory } from "../actions";
import { NewCategoryForm } from "./category-forms";

export const dynamic = "force-dynamic";

/** ຈັດການຄັງ — ເຫັນທຸກສະຖານະ ລວມທັງຮ່າງ ແລະ ບົດທີ່ລໍອະນຸມັດ */
export default async function ManageKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string }>;
}) {
  const { viewer } = await requireKbManager();
  const sp = await searchParams;
  const status = KB_STATUSES.includes(sp.status as KbStatus) ? sp.status : undefined;

  const [articles, categories] = await Promise.all([
    listArticles(viewer, { status }),
    listCategories(viewer),
  ]);
  const all = status ? await listArticles(viewer) : articles;

  const count = (s: KbStatus) => all.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title="ຈັດການຄັງຄວາມຮູ້"
        subtitle="ສ້າງ, ອະນຸມັດ ແລະ ເຜີຍແຜ່ບົດຄວາມ"
        action={<LinkButton href="/knowledge/manage/new">ສ້າງບົດໃໝ່</LinkButton>}
      />

      {sp.saved === "category" && (
        <p className="mb-5 rounded-md bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          ເພີ່ມໝວດແລ້ວ
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KB_STATUSES.map((s) => (
          <StatCard
            key={s}
            label={KB_STATUS_LABEL[s]}
            value={count(s)}
            tone={s === "PENDING" && count(s) > 0 ? "warn" : "default"}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/knowledge/manage"
          className={`rounded-md border px-3 py-1.5 transition ${!status ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-slate-50"}`}
        >
          ທັງໝົດ
        </Link>
        {KB_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/knowledge/manage?status=${s}`}
            className={`rounded-md border px-3 py-1.5 transition ${status === s ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-slate-50"}`}
          >
            {KB_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ຫົວຂໍ້</Th>
            <Th>ໝວດ</Th>
            <Th>ສະຖານະ</Th>
            <Th className="text-right">ຮຸ່ນ</Th>
            <Th>ຮັບຮູ້</Th>
            <Th>ອັບເດດ</Th>
          </tr>
        </thead>
        <tbody>
          {articles.length === 0 && <EmptyRow colSpan={6} text="ຍັງບໍ່ມີບົດ" />}
          {articles.map((a) => (
            <tr key={a.id}>
              <Td>
                <Link href={`/knowledge/manage/${a.id}`} className="font-medium hover:underline">
                  {a.title}
                </Link>
                {a.attachmentCount > 0 && (
                  <span className="ml-2 text-xs text-muted">ໄຟລ໌ {a.attachmentCount}</span>
                )}
              </Td>
              <Td className="text-muted">{a.categoryName ?? "-"}</Td>
              <Td>
                <Badge tone={KB_STATUS_TONE[a.status as KbStatus]}>
                  {KB_STATUS_LABEL[a.status as KbStatus]}
                </Badge>
              </Td>
              <Td className="tabular text-right">{a.version}</Td>
              <Td className="text-muted">{a.requiresAck ? "ບັງຄັບ" : "-"}</Td>
              <Td className="text-muted">{laoDate(a.updatedAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Card className="mt-8">
        <h2 className="mb-4 text-sm font-semibold">ໝວດຄວາມຮູ້</h2>
        <NewCategoryForm />

        {categories.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {c.nameLo}
                  <span className="ml-2 text-xs text-muted">{c.articleCount} ບົດ</span>
                </span>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-rose-600 underline underline-offset-2">ລຶບ</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          ລຶບໝວດແລ້ວ ບົດໃນໝວດນັ້ນຍັງຢູ່ ພຽງແຕ່ກາຍເປັນ “ບໍ່ລະບຸໝວດ”
        </p>
      </Card>
    </>
  );
}
