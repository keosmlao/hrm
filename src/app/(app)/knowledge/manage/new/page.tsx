import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { listCategories, requireKbManager } from "@/lib/kb-access";
import { ArticleForm } from "../article-form";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const { viewer } = await requireKbManager();

  const [categories, departments] = await Promise.all([
    listCategories(viewer),
    prisma.department.findMany({ select: { code: true, nameLo: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="ສ້າງບົດໃໝ່"
        subtitle="ບັນທຶກເປັນຮ່າງກ່ອນ — ຄ່ອຍສົ່ງອະນຸມັດ ຫຼື ເຜີຍແຜ່ຢູ່ໜ້າແກ້ໄຂ"
      />
      <ArticleForm categories={categories} departments={departments} />
    </>
  );
}
