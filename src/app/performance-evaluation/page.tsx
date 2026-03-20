"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import EvaluationForm from "@/components/evaluation-form";
import { AppShell, EmptyStatePanel, HeaderIconTile, PageHero, PageLoading, PageMetric } from "@/components/app-shell";

export default function PerformanceEvaluationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(null);
  const [summary, setSummary] = useState(null);
  const [noEmp, setNoEmp] = useState(false);

  useEffect(() => {
    apiFetch<{ emp: unknown; canViewSummary: boolean; submitted: unknown; summary: unknown }>("/page-data/performance-evaluation")
      .then((data) => {
        if (!data.emp) { setNoEmp(true); return; }
        setSubmitted(data.submitted as never);
        setSummary(data.summary as never);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PageLoading />;

  const totalResponses =
    summary && typeof summary === "object" && summary !== null && "total" in summary
      ? Number((summary as { total?: number }).total || 0)
      : 0;

  return (
    <AppShell
      title="ປະເມີນຜົນງານ OD 2026"
      description="ປະເມີນ event experience ແລະ ເບິ່ງຜົນສະຫຼຸບລວມໄດ້ໃນໜ້າດຽວ"
      icon={<HeaderIconTile accent="violet"><ClipboardIcon className="h-5 w-5" /></HeaderIconTile>}
      containerClassName="max-w-4xl"
    >
      <div className="space-y-6">
        <PageHero
          eyebrow="OD 2026 Review"
          title="ຮວບຮວມຄວາມຄິດເຫັນຈາກທີມງານແບບກະຊັບ"
          description="ໜ້ານີ້ອອກແບບໃຫ້ຕອບໄດ້ໄວ, ກວດສອບຜົນຂອງຕົນເອງ, ແລະ ເຫັນພາບລວມຂອງການປະເມີນໃນທັນທີ."
          badge={submitted ? "Submitted" : "Open"}
          accent="violet"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <PageMetric label="Status" value={submitted ? "ສົ່ງແລ້ວ" : "ຍັງບໍ່ສົ່ງ"} tone="violet" />
            <PageMetric label="Responses" value={totalResponses} tone="teal" />
          </div>
        </PageHero>

        {noEmp ? (
          <EmptyStatePanel
            title="ບໍ່ພົບຂໍ້ມູນພະນັກງານ"
            description="ລະບົບບໍ່ສາມາດຈັບຄູ່ບັນຊີນີ້ກັບ employee profile ໄດ້ ຈຶ່ງຍັງບໍ່ສາມາດຕອບແບບປະເມີນໄດ້."
          />
        ) : (
          <EvaluationForm submitted={submitted} summary={summary} />
        )}
      </div>
    </AppShell>
  );
}

function ClipboardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 2.5h5a1 1 0 0 1 1 1V4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.5 4H5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 15 4h-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 11.5 9 13l3.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
