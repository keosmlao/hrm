import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { generateAppraisals, toggleCycle } from "../actions";

export const dynamic = "force-dynamic";

const GRADE_TONE: Record<string, "green" | "blue" | "amber" | "gray" | "red"> = {
  A: "green",
  B: "blue",
  C: "amber",
  D: "gray",
  E: "red",
};

export default async function CyclePage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  await requireRole("ADMIN", "HR", "EXECUTIVE");
  const { cycleId } = await params;

  const cycle = await prisma.appraisalCycle.findUnique({
    where: { id: cycleId },
    include: {
      appraisals: {
        include: {
          employee: { select: { fullnameLo: true, titleLo: true } },
          evaluator: { select: { fullnameLo: true } },
        },
        orderBy: { employeeCode: "asc" },
      },
    },
  });
  if (!cycle) notFound();

  const done = cycle.appraisals.filter((a) => a.status === "COMPLETED");
  const avg =
    done.length > 0
      ? Math.round(done.reduce((s, a) => s + (a.score ?? 0), 0) / done.length)
      : 0;

  return (
    <>
      <PageHeader
        title={`${cycle.name} (${cycle.year})`}
        subtitle={`${cycle.appraisals.length} ໃບປະເມີນ · ສຳເລັດ ${done.length}`}
        action={
          <Link href="/appraisal" className="text-sm text-primary hover:underline">
            ← ກັບໄປ
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form action={generateAppraisals.bind(null, cycle.id)}>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-110">
            ສ້າງໃບປະເມີນໃຫ້ພະນັກງານທຸກຄົນ
          </button>
        </form>
        <form action={toggleCycle.bind(null, cycle.id, !cycle.isOpen)}>
          <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50">
            {cycle.isOpen ? "ປິດຮອບ" : "ເປີດຮອບ"}
          </button>
        </form>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="ໃບປະເມີນ" value={cycle.appraisals.length} />
        <StatCard label="ສຳເລັດ" value={`${done.length}/${cycle.appraisals.length}`} />
        <StatCard label="ຄະແນນສະເລ່ຍ" value={avg || "-"} tone="good" />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ພະນັກງານ</Th>
            <Th>ຜູ້ປະເມີນ</Th>
            <Th className="text-center">ຄະແນນ</Th>
            <Th className="text-center">ເກຣດ</Th>
            <Th>ສະຖານະ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {cycle.appraisals.length === 0 && (
            <EmptyRow colSpan={6} text="ຍັງບໍ່ມີໃບປະເມີນ — ກົດ “ສ້າງໃບປະເມີນ”" />
          )}
          {cycle.appraisals.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <Td>
                {a.employee.titleLo} {a.employee.fullnameLo}
              </Td>
              <Td className="text-xs text-muted">{a.evaluator?.fullnameLo ?? "— (HR)"}</Td>
              <Td className="text-center tabular">{a.score ?? "-"}</Td>
              <Td className="text-center">
                {a.grade ? <Badge tone={GRADE_TONE[a.grade] ?? "gray"}>{a.grade}</Badge> : "-"}
              </Td>
              <Td>
                <Badge tone={a.status === "COMPLETED" ? "green" : "amber"}>
                  {a.status === "COMPLETED" ? "ປະເມີນແລ້ວ" : "ລໍຖ້າ"}
                </Badge>
              </Td>
              <Td>
                <Link href={`/appraisal/eval/${a.id}`} className="text-primary hover:underline">
                  {a.status === "COMPLETED" ? "ເບິ່ງ/ແກ້" : "ປະເມີນ"} →
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
