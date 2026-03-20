import { useState } from "react";
import { apiFetch, apiPost } from "@/lib/api";

interface EvaluationRow {
  id: number;
  employee_code: string;
  q1: boolean;
  q2: boolean;
  q3: boolean;
  q4: boolean;
  q5: boolean;
  q6: boolean;
  comment: string | null;
  created_at: Date | string | null;
}

interface SummaryStats {
  total: number;
  q1_good: number;
  q2_good: number;
  q3_good: number;
  q4_good: number;
  q5_good: number;
  q6_good: number;
}

const QUESTIONS = [
  { key: "q1", label: "ທ່ານຄິດວ່າການຈັດງານ OD 2026 ເປັນແນວໃດ?" },
  { key: "q2", label: "ການເດີນທາງເປັນແນວໃດ?" },
  { key: "q3", label: "ກິດຈະກຳສັນທະນາການເປັນແນວໃດ?" },
  { key: "q4", label: "ງານລ້ຽງ ແລະ ການແຈກຂອງລາງວັນເປັນແນວໃດ?" },
  { key: "q5", label: "ອາຫານ ແລະ ເຄື່ອງດື່ມ ເປັນແນວໃດ?" },
  { key: "q6", label: "ການບໍລິການຂອງຜູ້ດຳເນີນງານ ເປັນແນວໃດ?" },
] as const;

interface EvaluationFormProps {
  submitted: EvaluationRow | null;
  summary: SummaryStats | null;
}

const panelClass =
  "rounded-[1.5rem] border border-white/70 bg-white/60 p-6 shadow-[0_10px_40px_-16px_rgba(15,23,42,0.16),0_0_0_1px_rgba(255,255,255,0.75)_inset] backdrop-blur-2xl";
const softCardClass = "rounded-xl border border-slate-100 bg-white/80 backdrop-blur";

export default function EvaluationForm({
  submitted: initialSubmitted,
  summary: initialSummary,
}: EvaluationFormProps) {
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [summary, setSummary] = useState(initialSummary);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: null,
    q6: null,
  });
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = QUESTIONS.every((question) => answers[question.key] !== null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!allAnswered) {
      setError("ກະລຸນາຕອບທຸກຄຳຖາມ");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiPost("/od-evaluation", {
        q1: answers.q1,
        q2: answers.q2,
        q3: answers.q3,
        q4: answers.q4,
        q5: answers.q5,
        q6: answers.q6,
        comment: comment || null,
      });

      const data = await apiFetch<{ submitted: EvaluationRow | null; summary: SummaryStats | null }>(
        "/od-evaluation"
      );
      setSubmitted(data.submitted);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const total = Number(summary?.total || 0);

    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/60 shadow-[0_10px_40px_-16px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
          <div className="bg-gradient-to-r from-violet-500 via-blue-500 to-teal-400 px-6 py-6 text-center text-white">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">ທ່ານໄດ້ປະເມີນແລ້ວ</h3>
            <p className="mt-1 text-sm text-white/80">ຂອບໃຈທີ່ຮ່ວມປະເມີນການຈັດງານ OD 2026</p>
          </div>
        </div>

        <div className={panelClass}>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">ຜົນການປະເມີນຂອງທ່ານ</h3>
          <div className="space-y-3">
            {QUESTIONS.map((question, index) => {
              const value = submitted[question.key as keyof EvaluationRow] as boolean;
              return (
                <div key={question.key} className={`${softCardClass} flex items-center justify-between px-4 py-3`}>
                  <span className="text-sm text-slate-700">
                    {index + 1}. {question.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      value ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {value ? "ດີ" : "ບໍ່ດີ"}
                  </span>
                </div>
              );
            })}
          </div>
          {submitted.comment && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Comment</p>
              <p className="mt-1 text-sm text-slate-700">{submitted.comment}</p>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className={panelClass}>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">ສະຫຼຸບຜົນປະເມີນລວມ</h3>
            <p className="mb-4 text-sm text-slate-500">ຈາກຜູ້ປະເມີນທັງໝົດ {total} ຄົນ</p>
            <div className="space-y-4">
              {QUESTIONS.map((question, index) => {
                const goodCount = Number(summary?.[`${question.key}_good` as keyof SummaryStats] || 0);
                const percent = total > 0 ? Math.round((goodCount / total) * 100) : 0;

                return (
                  <div key={question.key} className={`${softCardClass} px-4 py-4`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-700">
                        {index + 1}. {question.label}
                      </span>
                      <span className="text-sm font-semibold text-violet-700">{percent}% ດີ</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-teal-400 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-slate-400">
                      <span>ດີ {goodCount} ຄົນ</span>
                      <span>ບໍ່ດີ {total - goodCount} ຄົນ</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={panelClass}>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">ແບບປະເມີນການຈັດງານ OD 2026</h3>
        <p className="mb-6 text-sm text-slate-500">ກະລຸນາປະເມີນແຕ່ລະຫົວຂໍ້ໂດຍເລືອກ ດີ ຫຼື ບໍ່ດີ</p>

        <div className="space-y-4">
          {QUESTIONS.map((question, index) => (
            <div
              key={question.key}
              className={`rounded-xl border px-4 py-4 transition-all ${
                answers[question.key] !== null
                  ? "border-violet-200 bg-violet-50/70"
                  : "border-slate-100 bg-white/70"
              }`}
            >
              <p className="mb-3 text-sm font-medium text-slate-800">
                {index + 1}. {question.label}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.key]: true }))}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                    answers[question.key] === true
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_8px_20px_-12px_rgba(16,185,129,0.8)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                >
                  ດີ
                </button>
                <button
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.key]: false }))}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                    answers[question.key] === false
                      ? "border-rose-500 bg-rose-500 text-white shadow-[0_8px_20px_-12px_rgba(244,63,94,0.8)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50"
                  }`}
                >
                  ບໍ່ດີ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={panelClass}>
        <label className="mb-2 block text-sm font-medium text-slate-800">ຄຳເຫັນເພີ່ມເຕີມ (ຖ້າມີ)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 backdrop-blur transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          placeholder="ແນະນຳ ຫຼື ຄຳເຫັນເພີ່ມເຕີມ..."
        />
      </div>

      <div className={panelClass}>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !allAnswered}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-blue-600 to-teal-500 px-6 py-4 text-lg font-semibold text-white shadow-[0_14px_30px_-16px_rgba(59,130,246,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-16px_rgba(59,130,246,0.8)] active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isSubmitting ? "ກຳລັງບັນທຶກ..." : "ສົ່ງການປະເມີນ"}
        </button>

        {!allAnswered && (
          <p className="mt-2 text-center text-sm text-slate-400">ກະລຸນາຕອບທຸກ {QUESTIONS.length} ຄຳຖາມກ່ອນສົ່ງ</p>
        )}
      </div>
    </form>
  );
}
