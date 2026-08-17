import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, LinkButton } from "@/components/ui";
import { EMPLOYMENT_TYPE_LABEL } from "@/lib/labels";
import { laoDate } from "@/lib/format";

export default async function CareersPage() {
  const postings = await prisma.jobPosting.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">ຕຳແໜ່ງງານທີ່ເປີດຮັບສະໝັກ</h1>
        <p className="mt-1 text-sm text-muted">
          ຄົ້ນຫາໂອກາດການເຮັດວຽກກັບ ODIEN GROUP — ເລືອກຕຳແໜ່ງ ຫຼື ສະໝັກແບບທົ່ວໄປ
        </p>
      </div>

      {postings.length === 0 ? (
        <Card className="text-center">
          <p className="py-6 text-sm text-muted">
            ຂະນະນີ້ຍັງບໍ່ມີຕຳແໜ່ງທີ່ເປີດຮັບສະໝັກ — ແຕ່ທ່ານຍັງສາມາດຝາກໃບສະໝັກໄວ້ໄດ້
          </p>
          <LinkButton href="/careers/apply">ຝາກໃບສະໝັກທົ່ວໄປ</LinkButton>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {postings.map((p) => (
              <Link key={p.id} href={`/careers/${p.slug}`} className="block">
                <Card className="transition hover:border-primary hover:shadow">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-primary">{p.title}</h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge tone="blue">
                          {EMPLOYMENT_TYPE_LABEL[p.employmentType]}
                        </Badge>
                        {p.location && <span>📍 {p.location}</span>}
                        {p.openings > 1 && <span>· ຮັບ {p.openings} ຕຳແໜ່ງ</span>}
                        {p.closingDate && (
                          <span>· ປິດຮັບ {laoDate(p.closingDate)}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      ສະໝັກ →
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                      {p.description}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-dashed border-border p-5 text-center">
            <p className="text-sm text-muted">
              ບໍ່ພົບຕຳແໜ່ງທີ່ເໝາະສົມ?
            </p>
            <div className="mt-3">
              <LinkButton href="/careers/apply" variant="ghost">
                ຝາກໃບສະໝັກທົ່ວໄປ
              </LinkButton>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export const dynamic = "force-dynamic";
