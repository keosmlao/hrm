import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  Badge,
  EmptyRow,
  LinkButton,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  inputClass,
} from "@/components/ui";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
} from "@/lib/labels";
import { laoDate } from "@/lib/format";
import { Combobox } from "@/components/combobox";
import type { Prisma } from "@/generated/prisma/client";

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; posting?: string }>;
}) {
  await requireRole("ADMIN", "HR", "EXECUTIVE");
  const { q, status, posting } = await searchParams;

  const where: Prisma.JobApplicationWhereInput = {};
  const and: Prisma.JobApplicationWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { fullname: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { positionApplied: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (status) and.push({ status: status as never });
  if (posting) and.push({ jobPostingId: posting });
  if (and.length) where.AND = and;

  const [applications, postings, statusCounts] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      include: { jobPosting: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.jobPosting.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.jobApplication.groupBy({ by: ["status"], _count: true }),
  ]);

  const countOf = (s: string) =>
    statusCounts.find((c) => c.status === s)?._count ?? 0;
  const total = statusCounts.reduce((sum, c) => sum + c._count, 0);

  return (
    <>
      <PageHeader
        title="ຮັບສະໝັກງານ"
        subtitle="ຈັດການໃບສະໝັກ ແລະ ຕຳແໜ່ງທີ່ເປີດຮັບ"
        action={<LinkButton href="/recruitment/postings">ຈັດການປະກາດ</LinkButton>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ໃບສະໝັກທັງໝົດ" value={total} />
        <StatCard label="ໃໝ່ (ຍັງບໍ່ກວດ)" value={countOf("NEW")} tone="warn" />
        <StatCard label="ນັດສຳພາດ" value={countOf("INTERVIEW")} />
        <StatCard label="ຮັບເຂົ້າແລ້ວ" value={countOf("HIRED")} tone="good" />
      </div>

      <form className="mb-4 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="ຄົ້ນຫາ ຊື່ / ເບີໂທ / ຕຳແໜ່ງ"
          className={`${inputClass} max-w-xs`}
        />
        <Combobox
          name="status"
          defaultValue={status ?? ""}
          className="w-48"
          options={[
            { value: "", label: "ທຸກສະຖານະ" },
            ...Object.entries(APPLICATION_STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        <Combobox
          name="posting"
          defaultValue={posting ?? ""}
          className="w-64"
          options={[
            { value: "", label: "ທຸກຕຳແໜ່ງ" },
            ...postings.map((p) => ({ value: p.id, label: p.title })),
          ]}
        />
        <button className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-slate-50">
          ຄົ້ນຫາ
        </button>
      </form>

      <Table>
        <thead>
          <tr>
            <Th>ຜູ້ສະໝັກ</Th>
            <Th>ຕຳແໜ່ງ</Th>
            <Th>ເບີໂທ</Th>
            <Th>ວັນທີ່ສະໝັກ</Th>
            <Th>ສະຖານະ</Th>
          </tr>
        </thead>
        <tbody>
          {applications.length === 0 && <EmptyRow colSpan={5} />}
          {applications.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/recruitment/applications/${a.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {a.fullname}
                </Link>
              </Td>
              <Td className="text-xs">
                {a.jobPosting?.title ?? a.positionApplied ?? (
                  <span className="text-muted">ສະໝັກທົ່ວໄປ</span>
                )}
              </Td>
              <Td className="tabular">{a.phone}</Td>
              <Td>{laoDate(a.createdAt)}</Td>
              <Td>
                <Badge tone={APPLICATION_STATUS_TONE[a.status]}>
                  {APPLICATION_STATUS_LABEL[a.status]}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export const dynamic = "force-dynamic";
