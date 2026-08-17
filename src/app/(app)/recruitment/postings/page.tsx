import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  Badge,
  EmptyRow,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_POSTING_STATUS_LABEL,
  JOB_POSTING_STATUS_TONE,
} from "@/lib/labels";
import { laoDate } from "@/lib/format";

export default async function PostingsPage() {
  await requireRole("ADMIN", "HR");

  const postings = await prisma.jobPosting.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return (
    <>
      <PageHeader
        title="ປະກາດຮັບສະໝັກ"
        subtitle={`${postings.length} ປະກາດ`}
        action={<LinkButton href="/recruitment/postings/new">+ ສ້າງປະກາດ</LinkButton>}
      />

      <Table>
        <thead>
          <tr>
            <Th>ຕຳແໜ່ງ</Th>
            <Th>ປະເພດ</Th>
            <Th>ຮັບ</Th>
            <Th>ໃບສະໝັກ</Th>
            <Th>ປິດຮັບ</Th>
            <Th>ສະຖານະ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {postings.length === 0 && <EmptyRow colSpan={7} />}
          {postings.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <Td className="font-medium">{p.title}</Td>
              <Td className="text-xs">{EMPLOYMENT_TYPE_LABEL[p.employmentType]}</Td>
              <Td className="tabular">{p.openings}</Td>
              <Td className="tabular">
                <Link
                  href={`/recruitment?posting=${p.id}`}
                  className="text-primary hover:underline"
                >
                  {p._count.applications}
                </Link>
              </Td>
              <Td>{p.closingDate ? laoDate(p.closingDate) : "-"}</Td>
              <Td>
                <Badge tone={JOB_POSTING_STATUS_TONE[p.status]}>
                  {JOB_POSTING_STATUS_LABEL[p.status]}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-2 text-xs">
                  {p.status === "OPEN" && (
                    <Link
                      href={`/careers/${p.slug}`}
                      target="_blank"
                      className="text-muted hover:text-foreground"
                    >
                      ເບິ່ງໜ້າສາທາລະນະ ↗
                    </Link>
                  )}
                  <Link
                    href={`/recruitment/postings/${p.id}/edit`}
                    className="text-primary hover:underline"
                  >
                    ແກ້ໄຂ
                  </Link>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export const dynamic = "force-dynamic";
