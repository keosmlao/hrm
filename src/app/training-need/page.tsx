"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AuroraBackground } from "@/app/home/page";

const SKILLS: Record<string, string> = {
  "1": "ພາວະຜູ້ນຳ",
  "2": "ບົດບາດໜ້າທີ່ຂອງຫົວໜ້າງານ",
  "3": "ສິລະປະການບັງຄັບບັນຊາ",
  "4": "ທັກສະການວາງແຜນ ແລະ ບໍລິຫານງານ",
  "5": "ການບໍລິຫານທີມງານ ແລະ ບໍລິຫານຜົນງານ",
  "6": "ການສື່ສານ / ປະສານງານ / ມອບໝາຍ / ຕິດຕາມງານ",
  "7": "HR for Non HR (ການບໍລິຫານຄົນ)",
  "8": "ຈັນຍາບັນໃນການເຮັດວຽກ",
  "9": "ການແກ້ໄຂບັນຫາ ແລະ ການຕັດສິນໃຈ",
  "10": "ຫົວໃຈການບໍລິການ (Service Mind)",
  "11": "ການບໍລິຫານ KPI",
  "12": "ການຈັດການຄວາມຂັດແຍ່ງ",
  "13": "ການບໍລິຫານການປ່ຽນແປງ",
  "14": "ການສອນງານ ແລະ ພັດທະນາລູກທີມ",
  "15": "ການໃຊ້ເຄື່ອງມື AI (ChatGPT, Gemini)",
  "16": "Soft Skill",
};

interface SkillRank { id: string; voteCount: number; avgPriority: number; priorityCounts: number[]; }
interface ParticipantPerson { employeeCode: string; displayName: string; departmentName: string | null; }
interface ParticipantGroup { positionCode: string; label: string; total: number; submitted: number; remaining: number; submittedPeople: ParticipantPerson[]; remainingPeople: ParticipantPerson[]; }
interface SummaryData { totalTarget: number; totalSubmitted: number; totalRemaining: number; participantGroups: ParticipantGroup[]; ranked: SkillRank[]; teamProblems: string[]; suggestedCourses: string[]; }
interface PageData { isSurveyor: boolean; hasSubmitted: boolean; summary: SummaryData | null; }
interface ExportSheet { name: string; rows: Array<Array<string | number>>; }
interface ActiveListModal { title: string; people: ParticipantPerson[]; tone: "emerald" | "rose"; }

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }

export default function TrainingNeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveListModal | null>(null);

  useEffect(() => {
    apiFetch<PageData>("/page-data/training-need")
      .then(setData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!activeModal) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveModal(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

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

  const { isSurveyor, hasSubmitted, summary } = data;
  const ranked = (summary?.ranked || []).map((r) => ({ ...r, label: SKILLS[r.id] || `Skill ${r.id}` }));

  const handleExport = async () => {
    if (!summary) return;
    setIsExporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const workbookXml = buildExcelWorkbook([
        { name: "Summary", rows: [["ລາຍການ", "ຈຳນວນ"], ["ຜູ້ຕ້ອງຕອບ", summary.totalTarget], ["ຕອບແລ້ວ", summary.totalSubmitted], ["ຍັງບໍ່ທັນຕອບ", summary.totalRemaining], ["ຫົວຂໍ້ທີ່ຖືກເລືອກ", ranked.length], ...summary.participantGroups.flatMap((g) => ([[`${g.label} ທັງໝົດ`, g.total], [`${g.label} ຕອບແລ້ວ`, g.submitted], [`${g.label} ຍັງບໍ່ທັນຕອບ`, g.remaining]] as Array<[string, number]>))] },
        { name: "Ranking", rows: [["ລຳດັບ", "ຫົວຂໍ້ອົບຮົມ"], ...ranked.map((s, i) => [i + 1, s.label])] },
        { name: "Team Problems", rows: [["ລຳດັບ", "ບັນຫາຫຼັກ"], ...(summary.teamProblems.length > 0 ? summary.teamProblems.map((t, i) => [i + 1, t]) : [["", "ບໍ່ມີຂໍ້ມູນ"]])] },
        { name: "Suggested Courses", rows: [["ລຳດັບ", "ຫຼັກສູດແນະນຳ"], ...(summary.suggestedCourses.length > 0 ? summary.suggestedCourses.map((t, i) => [i + 1, t]) : [["", "ບໍ່ມີຂໍ້ມູນ"]])] },
        { name: "Participants", rows: [["ກຸ່ມ", "ສະຖານະ", "ຊື່", "ລະຫັດ", "ພະແນກ"], ...summary.participantGroups.flatMap((g) => [...g.submittedPeople.map((p) => [g.label, "ຕອບແລ້ວ", p.displayName, p.employeeCode, p.departmentName || "-"]), ...g.remainingPeople.map((p) => [g.label, "ຍັງບໍ່ທັນຕອບ", p.displayName, p.employeeCode, p.departmentName || "-"])])] },
      ]);
      const blob = new Blob([workbookXml], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `training-need-summary-${today}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export Excel:", error);
      window.alert("ບໍ່ສາມາດ export Excel ໄດ້");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="aurora-page min-h-screen text-slate-900">
        <AuroraBackground />

        {/* Header */}
        <header className="px-4 pt-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 shadow-lg shadow-black/[0.03] backdrop-blur-xl sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F65AB] shadow-sm">
                <BookOpenIcon className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">Training</p>
                <p className="text-sm font-bold text-slate-800">ຄວາມຕ້ອງການຝຶກອົບຮົມ</p>
              </div>
            </div>
            <Link href="/home" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-[#2F65AB]/5 hover:text-[#2F65AB]">
              ກັບໜ້າຫຼັກ
            </Link>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
          <div className="space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCell label="ຜູ້ຕ້ອງຕອບ" value={summary?.totalTarget ?? 0} />
              <StatCell label="ຕອບແລ້ວ" value={summary?.totalSubmitted ?? 0} />
              <StatCell label="ຍັງບໍ່ທັນຕອບ" value={summary?.totalRemaining ?? 0} />
              <StatCell label="ຫົວຂໍ້ທີ່ຖືກເລືອກ" value={ranked.length} />
            </div>

            {/* Survey action */}
            {isSurveyor ? (
              <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-5 py-4 backdrop-blur-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-800">ແບບສຳຫຼວດ</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {hasSubmitted ? "ທ່ານໄດ້ສົ່ງແບບສຳຫຼວດແລ້ວ" : "ກະລຸນາຕອບ survey ເພື່ອລະບຸທັກສະທີ່ຄວນພັດທະນາ"}
                  </p>
                </div>
                {hasSubmitted ? (
                  <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600">ສົ່ງແລ້ວ</span>
                ) : (
                  <Link href="/training-need/survey" className="rounded-xl bg-[#2F65AB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#265189]">
                    ເລີ່ມສຳຫຼວດ
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/60 bg-white/70 px-6 py-8 text-center backdrop-blur-sm">
                <p className="text-sm text-slate-500">ແບບສຳຫຼວດນີ້ສະເພາະຫົວໜ້າ ແລະ ຜູ້ຈັດການ</p>
              </div>
            )}

            {isSurveyor && summary && (
              <>
                {/* Participant groups */}
                {summary.participantGroups.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-base font-bold text-slate-800">ສະຫຼຸບຜູ້ຕອບ</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {summary.participantGroups.map((group) => (
                        <div key={group.positionCode} className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700">{group.label}</p>
                            <span className="text-xs text-slate-400">{group.total} ຄົນ</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveModal({ title: `${group.label} - ຕອບແລ້ວ`, people: group.submittedPeople, tone: "emerald" })}
                              disabled={group.submitted === 0}
                              className="rounded-xl bg-emerald-50 px-3 py-2.5 text-left transition-colors hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <p className="text-[0.65rem] text-emerald-600">ຕອບແລ້ວ</p>
                              <p className="text-lg font-bold text-emerald-700">{group.submitted}</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveModal({ title: `${group.label} - ຍັງບໍ່ທັນຕອບ`, people: group.remainingPeople, tone: "rose" })}
                              disabled={group.remaining === 0}
                              className="rounded-xl bg-rose-50 px-3 py-2.5 text-left transition-colors hover:bg-rose-100 disabled:opacity-50"
                            >
                              <p className="text-[0.65rem] text-rose-600">ຍັງບໍ່ທັນຕອບ</p>
                              <p className="text-lg font-bold text-rose-600">{group.remaining}</p>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Export */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="rounded-xl bg-[#2F65AB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#265189] disabled:opacity-60"
                  >
                    {isExporting ? "ກຳລັງ export..." : "Export Excel"}
                  </button>
                </div>

                {/* Ranked skills */}
                {ranked.length > 0 ? (
                  <section>
                    <h3 className="mb-3 text-base font-bold text-slate-800">ລຳດັບທັກສະ</h3>
                    <div className="space-y-2">
                      {ranked.map((skill, i) => (
                        <div key={skill.id} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur-sm">
                          <span className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                            i < 3 ? "bg-[#2F65AB] text-white" : "bg-slate-100 text-slate-500"
                          )}>
                            {i + 1}
                          </span>
                          <p className="text-sm font-medium text-slate-700">{skill.label}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="rounded-2xl border border-white/60 bg-white/70 px-6 py-8 text-center backdrop-blur-sm">
                    <p className="text-sm text-slate-400">ຍັງບໍ່ມີຂໍ້ມູນ. ກະລຸນາຕອບແບບສຳຫຼວດກ່ອນ.</p>
                  </div>
                )}

                {/* Team problems */}
                {summary.teamProblems.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-base font-bold text-slate-800">ບັນຫາຫຼັກໃນການບໍລິຫານທີມ</h3>
                    <div className="space-y-2">
                      {summary.teamProblems.map((text, i) => (
                        <div key={i} className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">{text}</div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Suggested courses */}
                {summary.suggestedCourses.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-base font-bold text-slate-800">ຫຼັກສູດທີ່ແນະນຳ</h3>
                    <div className="space-y-2">
                      {summary.suggestedCourses.map((text, i) => (
                        <div key={i} className="rounded-xl border border-[#2F65AB]/10 bg-[#2F65AB]/5 px-4 py-3 text-sm text-[#2F65AB]">{text}</div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* People list modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">{activeModal.title}</h3>
                <p className="text-xs text-slate-400">{activeModal.people.length} ຄົນ</p>
              </div>
              <button type="button" onClick={() => setActiveModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activeModal.people.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</p>
              ) : (
                <div className="space-y-2">
                  {activeModal.people.map((person) => (
                    <div key={person.employeeCode} className={cn("rounded-xl px-4 py-3", activeModal.tone === "emerald" ? "bg-emerald-50" : "bg-rose-50")}>
                      <p className="text-sm font-medium text-slate-700">{person.displayName}</p>
                      <p className="text-[0.65rem] text-slate-400">{person.employeeCode} · {person.departmentName || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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

/* ===== Helpers ===== */

function buildExcelWorkbook(sheets: ExportSheet[]) {
  const worksheets = sheets
    .map((sheet) => {
      const rows = sheet.rows
        .map((row, rowIndex) => {
          const cells = row
            .map((cell) => {
              const type = typeof cell === "number" ? "Number" : "String";
              const value = escapeExcelXml(String(cell));
              const style = rowIndex === 0 ? ' ss:StyleID="Header"' : "";
              return `<Cell${style}><Data ss:Type="${type}">${value}</Data></Cell>`;
            })
            .join("");
          return `<Row>${cells}</Row>`;
        })
        .join("");
      return `<Worksheet ss:Name="${escapeExcelXml(sheet.name)}"><Table>${rows}</Table></Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" />
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

function escapeExcelXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/* ===== Icons ===== */

function BookOpenIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M5.75 4.25h7.5A1.75 1.75 0 0 1 15 6v9.75H7.25A2.25 2.25 0 0 0 5 18V5a.75.75 0 0 1 .75-.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M5 15.75h8.75M8 7.5h4.5M8 10h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
