"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import StaffEvalForm from "@/components/staff-eval-form";
import SummaryTable from "@/components/summary-table";
import {
  buildStaffEvalPivotData,
  type StaffEvalCriteriaRow,
  type StaffEvalRow,
  type StaffEvalTeamTargetRow,
} from "@/lib/staff-eval-pivot";
import { AuroraBackground } from "@/app/home/page";

const MONTH_NAMES = [
  "", "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

const MONTH_ABBR = [
  "", "ມ.ກ.", "ກ.ພ.", "ມີ.ນ.", "ເມ.ສ.", "ພ.ພ.", "ມິ.ຖ.",
  "ກ.ລ.", "ສ.ຫ.", "ກ.ຍ.", "ຕ.ລ.", "ພ.ຈ.", "ທ.ວ.",
];

interface AvailableMonth { year: string; month: number; }
interface StaffEvalTarget { employee_code: string; fullname_lo: string; source: string; }

interface StaffEvaluationPageData {
  employeeCode: string;
  employeeName: string;
  criteria?: StaffEvalCriteriaRow[];
  selfEval: StaffEvalRow | null;
  myEvals: StaffEvalRow[];
  targets: StaffEvalTarget[];
  isManager: boolean;
  currentMonth: number;
  currentYear: string;
  availableMonths: AvailableMonth[];
  completedSelfMonths?: Array<{ year: string; month: number }>;
}

interface StaffEvalSummaryData {
  criteria: StaffEvalCriteriaRow[];
  selfEvals: StaffEvalRow[];
  teamEvals: StaffEvalRow[];
  teamTargetNames: StaffEvalTeamTargetRow[];
  isManager: boolean;
}

export default function StaffEvaluationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StaffEvaluationPageData | null>(null);
  const [summaryData, setSummaryData] = useState<StaffEvalSummaryData | null>(null);
  const [noEmp, setNoEmp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch<StaffEvaluationPageData>("/staff-evaluation"),
      apiFetch<StaffEvalSummaryData>("/page-data/staff-eval-summary").catch(() => null),
    ])
      .then(([pageData, summary]) => {
        if (cancelled) return;
        if (!pageData.criteria) { setNoEmp(true); return; }
        setData(pageData);
        if (summary) setSummaryData(summary);
      })
      .catch(() => { if (!cancelled) router.replace("/login"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
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

  const completedSelfMonths = new Set(
    (data?.completedSelfMonths || []).map((m) => `${m.year}-${m.month}`)
  );
  const availableMonths = (data?.availableMonths || []).map((m) => ({
    ...m,
    label: `${MONTH_NAMES[m.month]} ${m.year}`,
    selfDone: completedSelfMonths.has(`${m.year}-${m.month}`),
  }));
  const pivotSummary = summaryData
    ? buildStaffEvalPivotData({
        criteria: summaryData.criteria,
        selfEvals: summaryData.selfEvals,
        teamEvals: summaryData.teamEvals,
        teamTargetNames: summaryData.teamTargetNames,
      })
    : null;
  const overdueCount = availableMonths.filter((m) => !m.selfDone).length;

  return (
    <div className="aurora-page min-h-screen text-slate-900">
      <AuroraBackground />

      {/* Header */}
      <header className="px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 shadow-lg shadow-black/[0.03] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F65AB] shadow-sm">
              <ReviewIcon className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">Review</p>
              <p className="text-sm font-bold text-slate-800">ປະເມີນຜົນງານ</p>
            </div>
          </div>
          <Link href="/home" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-[#2F65AB]/5 hover:text-[#2F65AB]">
            ກັບໜ້າຫຼັກ
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
        {noEmp || !data ? (
          <div className="rounded-2xl border border-white/60 bg-white/70 px-6 py-10 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-slate-500">ບໍ່ພົບຂໍ້ມູນພະນັກງານ</p>
            <p className="mt-1 text-xs text-slate-400">ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCell label="ເດືອນປັດຈຸບັນ" value={MONTH_NAMES[data.currentMonth] || "-"} />
              <StatCell label="ເດືອນຄ້າງ" value={overdueCount} />
              <StatCell label="ເປົ້າໝາຍ" value={data.targets.length} />
              <StatCell label="ປະເມີນແລ້ວ" value={data.myEvals.length + (data.selfEval ? 1 : 0)} />
            </div>

            {/* Role badge */}
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#2F65AB]/10 px-2.5 py-1 text-xs font-semibold text-[#2F65AB]">
                {data.isManager ? "Manager + Self" : "Self Review"}
              </span>
              <span className="text-xs text-slate-400">{data.employeeName}</span>
            </div>

            {/* Eval form */}
            <StaffEvalForm
              employeeCode={data.employeeCode}
              employeeName={data.employeeName}
              isManager={data.isManager}
              criteria={data.criteria || []}
              selfEval={data.selfEval || null}
              managerEvals={data.myEvals || []}
              targets={data.targets || []}
              evalMonth={data.currentMonth}
              evalYear={data.currentYear}
              evalMonthLabel={MONTH_NAMES[data.currentMonth] || ""}
              availableMonths={availableMonths}
            />

            {/* Pivot summary */}
            {pivotSummary && (
              <section>
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800">ສະຫຼຸບຜົນປະເມີນປະຈຳປີ</h3>
                  <p className="mt-0.5 text-xs text-slate-400">ຄະແນນລາຍເດືອນແບບ pivot table ສຳລັບຕົນເອງ ແລະ ລູກທີມ</p>
                </div>
                <SummaryTable
                  selfPivot={pivotSummary.selfPivot}
                  teamPivot={pivotSummary.teamPivot}
                  isManager={summaryData?.isManager || false}
                  monthAbbr={MONTH_ABBR}
                  year={String(new Date().getFullYear())}
                  showHero={false}
                />
              </section>
            )}
          </div>
        )}
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

function ReviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.5 10.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
