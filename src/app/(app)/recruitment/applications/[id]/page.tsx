import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  GENDER_LABEL,
} from "@/lib/labels";
import { kip, laoDate, laoDateTime } from "@/lib/format";
import { StatusForm } from "./status-form";
import type { ReactNode } from "react";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border py-2.5 last:border-0">
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN", "HR", "EXECUTIVE");
  const { id } = await params;

  const a = await prisma.jobApplication.findUnique({
    where: { id },
    include: { jobPosting: { select: { title: true, slug: true } } },
  });
  if (!a) notFound();

  return (
    <>
      <Link
        href="/recruitment"
        className="text-sm text-muted hover:text-foreground"
      >
        ← ກັບໄປລາຍການໃບສະໝັກ
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{a.fullname}</h1>
          <p className="mt-1 text-sm text-muted">
            ສະໝັກ: {a.jobPosting?.title ?? a.positionApplied ?? "ທົ່ວໄປ"} ·
            ວັນທີ່ {laoDateTime(a.createdAt)}
          </p>
        </div>
        <Badge tone={APPLICATION_STATUS_TONE[a.status]}>
          {APPLICATION_STATUS_LABEL[a.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold">ຂໍ້ມູນຕິດຕໍ່ ແລະ ສ່ວນຕົວ</h2>
            <Row label="ເບີໂທ">
              <a href={`tel:${a.phone}`} className="text-primary hover:underline">
                {a.phone}
              </a>
            </Row>
            <Row label="ອີເມວ">
              {a.email ? (
                <a href={`mailto:${a.email}`} className="text-primary hover:underline">
                  {a.email}
                </a>
              ) : (
                "-"
              )}
            </Row>
            <Row label="ເພດ">{a.gender ? GENDER_LABEL[a.gender] : "-"}</Row>
            <Row label="ວັນເກີດ">{a.dob ? laoDate(a.dob) : "-"}</Row>
            <Row label="ທີ່ຢູ່">{a.address ?? "-"}</Row>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">ຄຸນວຸດທິ ແລະ ປະສົບການ</h2>
            <Row label="ການສຶກສາ">{a.education ?? "-"}</Row>
            <Row label="ເງິນເດືອນຄາດຫວັງ">
              {a.expectedSalary != null ? kip(Number(a.expectedSalary)) : "-"}
            </Row>
            <Row label="ຮູ້ຂ່າວຈາກ">{a.source ?? "-"}</Row>
            <Row label="ລິ້ງ CV">
              {a.resumeUrl ? (
                <a
                  href={a.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ເປີດ CV ↗
                </a>
              ) : (
                "-"
              )}
            </Row>
            {a.experience && (
              <div className="pt-3">
                <p className="mb-1 text-sm text-muted">ປະສົບການ</p>
                <p className="whitespace-pre-line text-sm">{a.experience}</p>
              </div>
            )}
            {a.coverLetter && (
              <div className="pt-3">
                <p className="mb-1 text-sm text-muted">ແນະນຳຕົນເອງ</p>
                <p className="whitespace-pre-line text-sm">{a.coverLetter}</p>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="mb-4 font-semibold">ຈັດການໃບສະໝັກ</h2>
            <StatusForm id={a.id} status={a.status} note={a.note} />
          </Card>
        </div>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
