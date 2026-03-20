"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import SummaryTable from "@/components/summary-table";
import {
  buildStaffEvalPivotData,
  type StaffEvalCriteriaRow,
  type StaffEvalRow,
  type StaffEvalTeamTargetRow,
} from "@/lib/staff-eval-pivot";
import { AuroraBackground } from "@/app/home/page";

const MONTH_ABBR = [
  "", "ມ.ກ.", "ກ.ພ.", "ມີ.ນ.", "ເມ.ສ.", "ພ.ພ.", "ມິ.ຖ.",
  "ກ.ລ.", "ສ.ຫ.", "ກ.ຍ.", "ຕ.ລ.", "ພ.ຈ.", "ທ.ວ.",
];

export default function StaffEvalSummaryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    criteria: StaffEvalCriteriaRow[];
    selfEvals: StaffEvalRow[];
    teamEvals: StaffEvalRow[];
    teamTargetNames: StaffEvalTeamTargetRow[];
    isManager: boolean;
  } | null>(null);

  useEffect(() => {
    apiFetch<{
      criteria: StaffEvalCriteriaRow[];
      selfEvals: StaffEvalRow[];
      teamEvals: StaffEvalRow[];
      teamTargetNames: StaffEvalTeamTargetRow[];
      isManager: boolean;
    }>("/page-data/staff-eval-summary")
      .then(setData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf0f7]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2F65AB]/20 border-t-[#2F65AB]" />
          <p className="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { selfPivot, teamPivot } = buildStaffEvalPivotData({
    criteria: data.criteria,
    selfEvals: data.selfEvals,
    teamEvals: data.teamEvals,
    teamTargetNames: data.teamTargetNames,
  });

  const currentYear = new Date().getFullYear();

  return (
    <div className="aurora-page min-h-screen text-slate-900">
      <AuroraBackground />

      <header className="px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 shadow-lg shadow-black/[0.03] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F65AB] shadow-sm">
              <ChartGridIcon className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">Summary</p>
              <p className="text-sm font-bold text-slate-800">ສະຫຼຸບການປະເມີນ</p>
            </div>
          </div>
          <Link href="/home" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-[#2F65AB]/5 hover:text-[#2F65AB]">
            ກັບໜ້າຫຼັກ
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        <div className="space-y-6">
          {/* Stats + badge */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid grid-cols-3 gap-3">
                <StatCell label="Self" value={selfPivot.length} />
                <StatCell label="Team" value={teamPivot.length} />
                <StatCell label="ປີ" value={currentYear} />
              </div>
            </div>
            <span className="rounded-lg bg-[#2F65AB]/10 px-2.5 py-1 text-xs font-semibold text-[#2F65AB]">
              {data.isManager ? "Manager View" : "Self View"}
            </span>
          </div>

          {/* Pivot table */}
          <SummaryTable
            selfPivot={selfPivot}
            teamPivot={teamPivot}
            isManager={data.isManager}
            monthAbbr={MONTH_ABBR}
            year={String(currentYear)}
            showHero={false}
          />
        </div>
      </main>
    </div>
  );
}

/* ===== Components ===== */

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50/80 px-3.5 py-3">
      <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function ChartGridIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="3" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="11.5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="11.5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
