import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { Badge, Card, PageHeader, Button, Field, inputClass } from "@/components/ui";
import { laoDateTime } from "@/lib/format";
import { saveAppraisal } from "../../actions";

export const dynamic = "force-dynamic";

const GRADE_TONE: Record<string, "green" | "blue" | "amber" | "gray" | "red"> = {
  A: "green",
  B: "blue",
  C: "amber",
  D: "gray",
  E: "red",
};

export default async function EvalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;

  const a = await prisma.appraisal.findUnique({
    where: { id },
    include: {
      employee: { select: { code: true, titleLo: true, fullnameLo: true } },
      evaluator: { select: { fullnameLo: true } },
      cycle: true,
    },
  });
  if (!a) notFound();

  const isEvaluator = a.evaluatorCode === session.employeeCode;
  const isHR = hasRole(session, "ADMIN", "HR");
  const isOwner = a.employeeCode === session.employeeCode;
  if (!isEvaluator && !isHR && !isOwner) redirect("/appraisal");

  const canEdit = (isEvaluator || isHR) && a.cycle.isOpen;

  return (
    <>
      <PageHeader
        title="ໃບປະເມີນຜົນ"
        subtitle={`${a.employee.titleLo ?? ""} ${a.employee.fullnameLo} · ${a.cycle.name} (${a.cycle.year})`}
        action={
          <Link href="/appraisal" className="text-sm text-primary hover:underline">
            ← ກັບໄປ
          </Link>
        }
      />

      {a.status === "COMPLETED" && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-muted">ຄະແນນ</p>
              <p className="tabular text-3xl font-bold">{a.score}</p>
            </div>
            <div>
              <p className="text-sm text-muted">ເກຣດ</p>
              {a.grade && (
                <Badge tone={GRADE_TONE[a.grade] ?? "gray"}>{a.grade}</Badge>
              )}
            </div>
            <p className="ml-auto text-xs text-muted">
              ປະເມີນໂດຍ {a.evaluator?.fullnameLo ?? "HR"} · {laoDateTime(a.evaluatedAt)}
            </p>
          </div>
        </Card>
      )}

      {canEdit ? (
        <form action={saveAppraisal.bind(null, a.id)} className="max-w-xl space-y-4">
          <Field label="ຄະແນນ (0–100)" required>
            <input
              name="score"
              type="number"
              min={0}
              max={100}
              defaultValue={a.score ?? undefined}
              className={inputClass}
            />
          </Field>
          <Field label="ຈຸດແຂງ">
            <textarea name="strengths" rows={2} defaultValue={a.strengths ?? ""} className={inputClass} />
          </Field>
          <Field label="ຈຸດຄວນປັບປຸງ">
            <textarea
              name="improvements"
              rows={2}
              defaultValue={a.improvements ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="ຄຳເຫັນ">
            <textarea name="comment" rows={3} defaultValue={a.comment ?? ""} className={inputClass} />
          </Field>
          <Button type="submit">ບັນທຶກ ແລະ ສຳເລັດ</Button>
        </form>
      ) : (
        <div className="max-w-xl space-y-4">
          <Info label="ຈຸດແຂງ" value={a.strengths} />
          <Info label="ຈຸດຄວນປັບປຸງ" value={a.improvements} />
          <Info label="ຄຳເຫັນ" value={a.comment} />
          {!a.cycle.isOpen && a.status !== "COMPLETED" && (
            <p className="text-sm text-muted">ຮອບນີ້ປິດແລ້ວ — ແກ້ໄຂບໍ່ໄດ້</p>
          )}
        </div>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-slate-600">
        {value || "-"}
      </p>
    </div>
  );
}
