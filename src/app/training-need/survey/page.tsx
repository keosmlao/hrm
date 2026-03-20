"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import TrainingNeedForm from "@/components/training-need-form";
import {
  AppShell,
  EmptyStatePanel,
  HeaderIconTile,
  PageHero,
  PageLoading,
  PageMetric,
} from "@/components/app-shell";

interface SurveyData {
  alreadySubmitted: boolean;
  employeeName?: string;
  departmentName?: string;
  teamCount?: number;
  trainingNeeds?: unknown[];
}

export default function TrainingNeedSurveyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SurveyData>("/page-data/training-need/survey")
      .then((response) => {
        if (response.alreadySubmitted) {
          router.replace("/training-need");
        } else {
          setData(response);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else if (err instanceof ApiError && err.status === 403) {
          router.replace("/training-need");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load survey");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PageLoading />;

  return (
    <AppShell
      title="ແບບສຳຫຼວດຄວາມຕ້ອງການຝຶກອົບຮົມ"
      description="ກອກ survey ໃຫ້ຄົບໃນ workflow ດຽວ ແລະ ສົ່ງເຂົ້າລະບົບໄດ້ທັນທີ"
      icon={<HeaderIconTile accent="teal"><SurveyIcon className="h-5 w-5" /></HeaderIconTile>}
      backHref="/training-need"
      backLabel="ກັບຫນ້າສະຫຼຸບ"
      containerClassName="max-w-5xl"
    >
      {error ? (
        <EmptyStatePanel
          title="ບໍ່ສາມາດໂຫຼດ survey ໄດ້"
          description={error}
        />
      ) : !data ? null : (
        <div className="space-y-6">
          <PageHero
            eyebrow="Training Survey"
            title="ລວບລວມທັກສະທີ່ທີມງານຕ້ອງການ"
            description="ແບບສຳຫຼວດນີ້ເນັ້ນໃຫ້ຫົວໜ້າສາມາດຈັດລຳດັບຄວາມສຳຄັນ, ສະຫຼຸບບັນຫາຫຼັກ, ແລະ ແນະນຳຫຼັກສູດໄດ້ໃນຟອມດຽວ."
            badge="Open Survey"
            accent="teal"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <PageMetric label="Employee" value={data.employeeName || "-"} tone="teal" />
              <PageMetric label="Department" value={data.departmentName || "-"} tone="blue" />
              <PageMetric label="Team Size" value={data.teamCount || 0} tone="amber" />
            </div>
          </PageHero>

          <TrainingNeedForm
            initialData={data.trainingNeeds as never[]}
            employeeName={data.employeeName || ""}
            departmentName={data.departmentName || "-"}
            teamCount={data.teamCount || 0}
          />
        </div>
      )}
    </AppShell>
  );
}

function SurveyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5.75 4.25h7.5A1.75 1.75 0 0 1 15 6v9.75H7.25A2.25 2.25 0 0 0 5 18V5a.75.75 0 0 1 .75-.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 15.75h8.75M8 7.5h4.5M8 10h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
