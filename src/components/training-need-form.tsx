import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiPost } from "@/lib/api";

interface Skill {
  id: string;
  label: string;
  hasInput?: boolean;
}

const SKILLS: Skill[] = [
  { id: "1", label: "ພາວະຜູ້ນຳ (ภาวะของผู้นำ)" },
  { id: "2", label: "ບົດບາດໜ້າທີ່ຂອງຫົວໜ້າງານ" },
  { id: "3", label: "ສິລະປະການບັງຄັບບັນຊາ" },
  { id: "4", label: "ທັກສະການວາງແຜນ ແລະ ບໍລິຫານງານ" },
  { id: "5", label: "ການບໍລິຫານທີມງານ ແລະ ບໍລິຫານຜົນງານ" },
  { id: "6", label: "ການສື່ສານ / ປະສານງານ / ມອບໝາຍ / ຕິດຕາມງານ" },
  { id: "7", label: "HR for Non HR (ການບໍລິຫານຄົນ)" },
  { id: "8", label: "ຈັນຍາບັນໃນການເຮັດວຽກ" },
  { id: "9", label: "ການແກ້ໄຂບັນຫາ ແລະ ການຕັດສິນໃຈ" },
  { id: "10", label: "ຫົວໃຈການບໍລິການ (Service Mind)" },
  { id: "11", label: "ການບໍລິຫານ KPI" },
  { id: "12", label: "ການຈັດການຄວາມຂັດແຍ່ງ" },
  { id: "13", label: "ການບໍລິຫານການປ່ຽນແປງ" },
  { id: "14", label: "ການສອນງານ ແລະ ພັດທະນາລູກທີມ" },
  { id: "15", label: "ການໃຊ້ເຄື່ອງມື AI (ChatGPT, Gemini)" },
  { id: "16", label: "Soft Skill", hasInput: true },
];

const MAX_SKILL_PRIORITY = SKILLS.length;

function playSuccessChime() {
  if (typeof window === "undefined") return;

  const audioWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const now = context.currentTime;
    const notes = [
      { frequency: 659.25, start: 0, duration: 0.12 },
      { frequency: 783.99, start: 0.12, duration: 0.14 },
      { frequency: 1046.5, start: 0.28, duration: 0.2 },
    ];

    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.08, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration);
    }

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 1000);
  } catch {
    // Ignore audio failures so save success is not blocked.
  }
}

function getPriorityEntries(skillPriorities: Record<string, string>) {
  return SKILLS.flatMap((skill) => {
    const rawValue = skillPriorities[skill.id]?.trim() ?? "";
    if (rawValue === "") return [];

    return [
      {
        skillId: skill.id,
        value: Number(rawValue),
      },
    ];
  });
}

function getDuplicatePriorityValues(skillPriorities: Record<string, string>) {
  const counts = new Map<number, number>();

  for (const entry of getPriorityEntries(skillPriorities)) {
    if (!Number.isInteger(entry.value) || entry.value < 1 || entry.value > MAX_SKILL_PRIORITY) {
      continue;
    }
    counts.set(entry.value, (counts.get(entry.value) ?? 0) + 1);
  }

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([value]) => value)
  );
}

function getAvailablePriorityOptions(skillId: string, skillPriorities: Record<string, string>) {
  const usedValues = new Set(
    Object.entries(skillPriorities)
      .filter(([otherSkillId, value]) => otherSkillId !== skillId && value !== "")
      .map(([, value]) => Number(value))
  );

  return Array.from({ length: MAX_SKILL_PRIORITY }, (_, index) => index + 1).filter(
    (value) => !usedValues.has(value)
  );
}

function validateSkillPriorities(skillPriorities: Record<string, string>) {
  const entries = getPriorityEntries(skillPriorities);

  if (entries.length !== MAX_SKILL_PRIORITY) {
    return `ກະລຸນາໃສ່ລຳດັບໃຫ້ຄົບທັງ ${MAX_SKILL_PRIORITY} ຂໍ້`;
  }

  const seen = new Set<number>();
  for (const entry of entries) {
    if (!Number.isInteger(entry.value) || entry.value < 1 || entry.value > MAX_SKILL_PRIORITY) {
      return `ກະລຸນາໃສ່ເລກ 1-${MAX_SKILL_PRIORITY} ເທົ່ານັ້ນ`;
    }

    if (seen.has(entry.value)) {
      return "ລຳດັບຄວາມສຳຄັນຫ້າມຊໍ້າກັນ";
    }
    seen.add(entry.value);
  }

  return null;
}

interface TrainingNeedRow {
  id: number;
  employee_code: string;
  department_name: string | null;
  team_count: number | null;
  supervisor_years: string | null;
  skill_priorities: Record<string, number> | null;
  team_problems: string | null;
  suggested_course: string | null;
  fiscal_year: string;
  status: string;
  created_at: Date | string;
}

interface TrainingNeedFormProps {
  initialData: TrainingNeedRow[];
  employeeName: string;
  departmentName: string;
  teamCount: number;
}

const statusLabels: Record<string, string> = {
  PENDING: "ລໍຖ້າ",
  APPROVED: "ອະນຸມັດ",
  REJECTED: "ປະຕິເສດ",
  COMPLETED: "ສຳເລັດ",
};

const statusColors: Record<string, string> = {
  PENDING: "border-violet-200 bg-violet-50 text-violet-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  COMPLETED: "border-blue-200 bg-blue-50 text-blue-700",
};

export default function TrainingNeedForm({
  initialData,
  employeeName,
  departmentName,
  teamCount,
}: TrainingNeedFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<TrainingNeedRow[]>(initialData);
  const [supervisorYears, setSupervisorYears] = useState("");
  const [skillPriorities, setSkillPriorities] = useState<Record<string, string>>({});
  const [softSkillTopic, setSoftSkillTopic] = useState("");
  const [teamProblems, setTeamProblems] = useState("");
  const [suggestedCourse, setSuggestedCourse] = useState("");
  const [fiscalYear, setFiscalYear] = useState("2026");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const duplicatePriorityValues = getDuplicatePriorityValues(skillPriorities);

  const handleSkillPriorityChange = (skillId: string, value: string) => {
    const updated = { ...skillPriorities };
    const trimmedValue = value.trim();

    if (trimmedValue === "") {
      delete updated[skillId];
    } else {
      if (!/^\d{1,2}$/.test(trimmedValue)) return;

      const parsedValue = Number(trimmedValue);
      if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > MAX_SKILL_PRIORITY) {
        return;
      }

      updated[skillId] = String(parsedValue);
    }

    setSkillPriorities(updated);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    const skillPriorityError = validateSkillPriorities(skillPriorities);
    if (skillPriorityError) {
      setError(skillPriorityError);
      setIsSubmitting(false);
      return;
    }

    const priorities: Record<string, number> = {};
    for (const skill of SKILLS) {
      priorities[skill.id] = Number(skillPriorities[skill.id]);
    }

    const skillData: Record<string, number | string> = { ...priorities };
    if (softSkillTopic) {
      skillData["16_topic"] = softSkillTopic;
    }

    try {
      await apiPost("/training-needs", {
        department_name: departmentName,
        team_count: teamCount,
        supervisor_years: supervisorYears || null,
        skill_priorities: skillData,
        team_problems: teamProblems || null,
        suggested_course: suggestedCourse || null,
        fiscal_year: fiscalYear,
      });

      setSuccess(true);
      playSuccessChime();
      setSupervisorYears("");
      setSkillPriorities({});
      setSoftSkillTopic("");
      setTeamProblems("");
      setSuggestedCourse("");

      const updatedItems = await apiFetch<TrainingNeedRow[]>("/training-needs");
      setItems(updatedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 backdrop-blur transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Part 1 */}
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
          <div className="border-b border-slate-100 bg-gradient-to-r from-violet-500 via-blue-500 to-teal-400 px-6 py-4">
            <h3 className="text-lg font-bold text-white">
              ສ່ວນທີ 1 : ຂໍ້ມູນທົ່ວໄປ
            </h3>
            <p className="mt-0.5 text-sm text-white/70">ຂໍ້ມູນພື້ນຖານຂອງຜູ້ຕອບແບບສຳຫຼວດ</p>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">1. ຊື່-ນາມສະກຸນ</label>
              <input type="text" value={employeeName} readOnly className={`${inputClass} !bg-slate-50/80`} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">2. ພະແນກ</label>
              <input type="text" value={departmentName} readOnly className={`${inputClass} !bg-slate-50/80`} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">3. ຈຳນວນລູກທີມທີ່ເບິ່ງແຍງ (ຄົນ)</label>
              <input type="number" value={teamCount} readOnly className={`${inputClass} !bg-slate-50/80`} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">4. ອາຍຸງານໃນຕຳແໜ່ງຫົວໜ້າ</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: "<1", label: "ຕໍ່າກວ່າ 1 ປີ" },
                  { value: "1-3", label: "1–3 ປີ" },
                  { value: ">3", label: "ຫຼາຍກວ່າ 3 ປີ" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      supervisorYears === opt.value
                        ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="supervisor_years"
                      value={opt.value}
                      checked={supervisorYears === opt.value}
                      onChange={(e) => setSupervisorYears(e.target.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Part 2 */}
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 px-6 py-4">
            <h3 className="text-lg font-bold text-white">
              ສ່ວນທີ 2 : ຄວາມຕ້ອງການພັດທະນາ
            </h3>
            <p className="mt-0.5 text-sm text-white/70">ໃສ່ລຳດັບຄວາມສຳຄັນ (1 = ສຳຄັນທີ່ສຸດ)</p>
          </div>
          <div className="p-6">
            <label className="mb-3 block text-sm font-semibold text-slate-700">
              1. ທັກສະທີ່ທ່ານຕ້ອງການພັດທະນາຮີບດ່ວນ
              <span className="ml-1 text-rose-500">*</span>
            </label>
            <p className="mb-4 text-sm text-slate-500">
              ກະລຸນາໃສ່ລຳດັບ 1-16 ໃຫ້ຄົບ ແລະ ບໍ່ໃຫ້ມີເລກຊໍ້າກັນ
            </p>
            <div className="space-y-2">
              {SKILLS.map((skill) => {
                const isActive = !!skillPriorities[skill.id];
                const isDuplicate =
                  skillPriorities[skill.id] != null &&
                  duplicatePriorityValues.has(Number(skillPriorities[skill.id]));
                const availablePriorityOptions = getAvailablePriorityOptions(skill.id, skillPriorities);
                return (
                  <div
                    key={skill.id}
                    className={`rounded-xl border px-4 py-3 transition-all ${
                      isActive
                        ? "border-violet-200 bg-violet-50/60 shadow-sm"
                        : "border-slate-100 bg-white/60 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <select
                        value={skillPriorities[skill.id] || ""}
                        onChange={(e) => handleSkillPriorityChange(skill.id, e.target.value)}
                        aria-invalid={isDuplicate}
                        className={`w-20 shrink-0 rounded-lg border bg-white px-2 py-2 text-center text-sm font-semibold text-slate-900 transition-all focus:outline-none focus:ring-2 ${
                          isDuplicate
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                            : "border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                        }`}
                      >
                        <option value="">-</option>
                        {availablePriorityOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <span className={`text-sm ${isActive ? "font-medium text-violet-900" : "text-slate-700"}`}>
                        {skill.label}
                      </span>
                    </div>
                    {skill.hasInput && (
                      <div className="mt-2 ml-[68px]">
                        <input
                          type="text"
                          value={softSkillTopic}
                          onChange={(e) => setSoftSkillTopic(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                          placeholder="ລະບຸຫົວຂໍ້ Soft Skill..."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {duplicatePriorityValues.size > 0 && (
              <p className="mt-4 text-sm font-medium text-rose-600">
                ພົບລຳດັບທີ່ຊໍ້າກັນ ກະລຸນາປ່ຽນໃຫ້ແຕ່ລະຂໍ້ເປັນເລກບໍ່ຊໍ້າ
              </p>
            )}

            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                2. ບັນຫາຫຼັກທີ່ພົບໃນການບໍລິຫານທີມຂອງທ່ານຄືຫຍັງ?
              </label>
              <textarea
                value={teamProblems}
                onChange={(e) => setTeamProblems(e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="ອະທິບາຍບັນຫາທີ່ພົບ..."
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                3. ຖ້າບໍລິສັດຈັດອົບຮົມ 1 ຫຼັກສູດທີ່ສຳຄັນທີ່ສຸດສຳລັບທ່ານ ຄວນເປັນເລື່ອງໃດ?
              </label>
              <textarea
                value={suggestedCourse}
                onChange={(e) => setSuggestedCourse(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="ລະບຸຫຼັກສູດທີ່ຕ້ອງການ..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="rounded-2xl border border-white/70 bg-white/60 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              ສົກປີ <span className="text-rose-500">*</span>
            </label>
            <select value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className={inputClass}>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-teal-500 px-6 py-4 text-lg font-bold text-white shadow-[0_4px_16px_-4px_rgba(139,92,246,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(139,92,246,0.4)] active:translate-y-0 active:scale-[0.99] disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isSubmitting ? "ກຳລັງບັນທຶກ..." : "ສົ່ງແບບສຳຫຼວດ"}
          </button>
        </div>
      </form>

      {/* History */}
      {items.length > 0 && (
        <div className="rounded-2xl border border-white/70 bg-white/60 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
          <h3 className="mb-4 text-lg font-bold text-slate-900">
            ລາຍການທີ່ສົ່ງແລ້ວ ({items.length})
          </h3>
          <div className="space-y-3">
            {items.map((item) => {
              const priorities = item.skill_priorities || {};
              const selectedSkills = SKILLS.filter(
                (s) => priorities[s.id] != null
              ).sort(
                (a, b) => (priorities[a.id] as number) - (priorities[b.id] as number)
              );

              return (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-white/80 p-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-400">
                      ສົກປີ {item.fiscal_year} &middot;{" "}
                      {new Date(item.created_at).toLocaleDateString("lo-LA")}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusColors[item.status] || "border-slate-200 bg-slate-50 text-slate-700"}`}
                    >
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  {selectedSkills.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-400">ທັກສະທີ່ເລືອກ:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSkills.map((s) => (
                          <span key={s.id} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                            #{priorities[s.id]} {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.suggested_course && (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">ຫຼັກສູດແນະນຳ:</span>{" "}
                      {item.suggested_course}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-need-success-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,0.35)]"
          >
            <div className="bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_50%,#38bdf8_100%)] px-6 py-6 text-white">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18 backdrop-blur">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 12.5 10 16.5 18.5 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 id="training-need-success-title" className="text-2xl font-bold">
                ບັນທຶກສຳເລັດ
              </h3>
              <p className="mt-2 text-sm text-white/85">
                ລະບົບໄດ້ຮັບຄຳຕອບແບບສຳຫຼວດຂອງທ່ານແລ້ວ
              </p>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-800">
                ສາມາດກົດປຸ່ມດ້ານລຸ່ມເພື່ອກັບຄືນໄປໜ້າສະຫຼຸບຄວາມຕ້ອງການຝຶກອົບຮົມ
              </div>

              <button
                type="button"
                onClick={() => router.replace("/training-need")}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-blue-600 to-teal-500 px-5 py-3.5 text-base font-bold text-white shadow-[0_10px_28px_-12px_rgba(59,130,246,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgba(59,130,246,0.7)] active:translate-y-0 active:scale-[0.99]"
              >
                ກັບຄືນ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
