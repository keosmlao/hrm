import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card } from "@/components/ui";
import { EMPLOYMENT_TYPE_LABEL } from "@/lib/labels";
import { laoDate } from "@/lib/format";
import { ApplicationForm } from "../application-form";

export default async function JobPostingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posting = await prisma.jobPosting.findUnique({ where: { slug } });

  if (!posting || posting.status !== "OPEN") notFound();

  return (
    <>
      <Link
        href="/careers"
        className="text-sm text-muted hover:text-foreground"
      >
        ← ກັບໄປລາຍການຕຳແໜ່ງ
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">{posting.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone="blue">
            {EMPLOYMENT_TYPE_LABEL[posting.employmentType]}
          </Badge>
          {posting.location && <span>📍 {posting.location}</span>}
          {posting.salaryRange && <span>· 💰 {posting.salaryRange}</span>}
          {posting.openings > 1 && <span>· ຮັບ {posting.openings} ຕຳແໜ່ງ</span>}
          {posting.closingDate && (
            <span>· ປິດຮັບ {laoDate(posting.closingDate)}</span>
          )}
        </div>
      </div>

      {(posting.description || posting.requirements) && (
        <Card className="mb-6 space-y-5">
          {posting.description && (
            <div>
              <h2 className="mb-1.5 font-semibold">ໜ້າທີ່ຮັບຜິດຊອບ</h2>
              <p className="whitespace-pre-line text-sm text-slate-600">
                {posting.description}
              </p>
            </div>
          )}
          {posting.requirements && (
            <div>
              <h2 className="mb-1.5 font-semibold">ຄຸນສົມບັດຜູ້ສະໝັກ</h2>
              <p className="whitespace-pre-line text-sm text-slate-600">
                {posting.requirements}
              </p>
            </div>
          )}
        </Card>
      )}

      <h2 className="mb-4 text-lg font-semibold">ຟອມສະໝັກ</h2>
      <ApplicationForm posting={{ id: posting.id, title: posting.title }} />
    </>
  );
}

export const dynamic = "force-dynamic";
