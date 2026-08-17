import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PostingForm } from "../../posting-form";
import { loadPostingOptions } from "../../options";
import { updatePosting } from "../../../actions";

export default async function EditPostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const { id } = await params;

  const [posting, options] = await Promise.all([
    prisma.jobPosting.findUnique({ where: { id } }),
    loadPostingOptions(),
  ]);
  if (!posting) notFound();

  return (
    <>
      <PageHeader title={`ແກ້ໄຂ: ${posting.title}`} />
      <PostingForm
        action={updatePosting.bind(null, id)}
        options={options}
        values={{
          title: posting.title,
          departmentCode: posting.departmentCode,
          positionCode: posting.positionCode,
          employmentType: posting.employmentType,
          location: posting.location,
          openings: posting.openings,
          salaryRange: posting.salaryRange,
          description: posting.description,
          requirements: posting.requirements,
          status: posting.status,
          closingDate: posting.closingDate,
        }}
        submitLabel="ບັນທຶກການແກ້ໄຂ"
      />
    </>
  );
}

export const dynamic = "force-dynamic";
