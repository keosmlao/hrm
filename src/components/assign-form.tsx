import { useState } from "react";
import { apiDelete, apiPost } from "@/lib/api";

interface AssignedRow {
  id: number;
  target_code: string;
  fullname_lo: string | null;
  position_code: string | null;
  position_name_lo: string | null;
  department_code: string | null;
  department_name_lo: string | null;
}

interface CandidateRow {
  employee_code: string;
  fullname_lo: string | null;
  position_code: string | null;
  position_name_lo: string | null;
  department_code: string | null;
  department_name_lo: string | null;
}

interface AssignFormProps {
  assigned: AssignedRow[];
  candidates: CandidateRow[];
}

function getPositionLevel(posCode: string | null): { order: number; label: string } {
  switch (posCode) {
    case "12":
      return { order: 1, label: "ຫົວໜ້າ" };
    default:
      return { order: 2, label: "ພະນັກງານ" };
  }
}

const PAGE_SIZE = 10;
const panelClass =
  "rounded-[1.5rem] border border-white/70 bg-white/60 shadow-[0_10px_40px_-16px_rgba(15,23,42,0.16),0_0_0_1px_rgba(255,255,255,0.75)_inset] backdrop-blur-2xl";
const itemClass = "rounded-xl border border-slate-100 bg-white/80 px-4 py-3 backdrop-blur";
const primaryButtonClass =
  "rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-teal-500 text-white shadow-[0_10px_24px_-12px_rgba(59,130,246,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-12px_rgba(59,130,246,0.75)] active:translate-y-0 active:scale-[0.98]";

export default function AssignForm({
  assigned: initialAssigned,
  candidates: initialCandidates,
}: AssignFormProps) {
  const [assigned, setAssigned] = useState(initialAssigned);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [page, setPage] = useState(0);

  const assignedByLevel: Record<string, { order: number; rows: AssignedRow[] }> = {};
  for (const row of assigned) {
    const level = getPositionLevel(row.position_code);
    if (!assignedByLevel[level.label]) {
      assignedByLevel[level.label] = { order: level.order, rows: [] };
    }
    assignedByLevel[level.label].rows.push(row);
  }

  const sortedAssignedLevels = Object.entries(assignedByLevel).sort(
    (a, b) => a[1].order - b[1].order
  );

  const modalFiltered = modalSearch.trim()
    ? candidates.filter(
        (candidate) =>
          candidate.fullname_lo?.toLowerCase().includes(modalSearch.toLowerCase()) ||
          candidate.employee_code.includes(modalSearch) ||
          candidate.department_name_lo?.toLowerCase().includes(modalSearch.toLowerCase()) ||
          candidate.position_name_lo?.toLowerCase().includes(modalSearch.toLowerCase())
      )
    : candidates;

  const totalPages = Math.ceil(modalFiltered.length / PAGE_SIZE);
  const paged = modalFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openModal = () => {
    setModalSearch("");
    setPage(0);
    setShowModal(true);
  };

  const handleAdd = async (candidate: CandidateRow) => {
    setLoading(candidate.employee_code);
    setError(null);
    try {
      const data = await apiPost<{ id: number }>("/staff-eval-assign", {
        target_code: candidate.employee_code,
      });
      setAssigned((prev) => [
        ...prev,
        {
          id: data.id,
          target_code: candidate.employee_code,
          fullname_lo: candidate.fullname_lo,
          position_code: candidate.position_code,
          position_name_lo: candidate.position_name_lo,
          department_code: candidate.department_code,
          department_name_lo: candidate.department_name_lo,
        },
      ]);
      setCandidates((prev) => prev.filter((candidateRow) => candidateRow.employee_code !== candidate.employee_code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (row: AssignedRow) => {
    setLoading(`rm-${row.id}`);
    setError(null);
    try {
      await apiDelete("/staff-eval-assign", { id: row.id });
      setAssigned((prev) => prev.filter((assignedRow) => assignedRow.id !== row.id));
      setCandidates((prev) =>
        [
          ...prev,
          {
            employee_code: row.target_code,
            fullname_lo: row.fullname_lo,
            position_code: row.position_code,
            position_name_lo: row.position_name_lo,
            department_code: row.department_code,
            department_name_lo: row.department_name_lo,
          },
        ].sort((a, b) => (a.fullname_lo || "").localeCompare(b.fullname_lo || ""))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${panelClass} p-6`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">ລາຍຊື່ຜູ້ຖືກປະເມີນເພີ່ມເຕີມ</h3>
            <p className="mt-1 text-sm text-slate-500">{assigned.length} ຄົນ</p>
          </div>
          <button onClick={openModal} className={`${primaryButtonClass} shrink-0 px-4 py-2.5 text-sm font-semibold`}>
            + ເພີ່ມ
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {assigned.length === 0 ? (
          <p className="mt-4 py-4 text-center text-sm text-slate-400">ຍັງບໍ່ໄດ້ເພີ່ມຜູ້ຖືກປະເມີນ</p>
        ) : (
          <div className="mt-4 space-y-4">
            {sortedAssignedLevels.map(([levelLabel, { rows }]) => (
              <div key={levelLabel}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {levelLabel} ({rows.length})
                </p>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <div key={row.id} className={`flex items-center justify-between gap-3 ${itemClass}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{row.fullname_lo || row.target_code}</p>
                        <p className="text-xs text-slate-500">
                          {row.position_name_lo || "-"} &middot; {row.department_name_lo || "-"} &middot; {row.target_code}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(row)}
                        disabled={loading === `rm-${row.id}`}
                        className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 active:scale-[0.98] disabled:opacity-70"
                      >
                        {loading === `rm-${row.id}` ? "..." : "ລົບ"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          <div className={`relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-[1.7rem] sm:rounded-[1.7rem] ${panelClass}`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">ເພີ່ມຜູ້ຖືກປະເມີນ</h3>
                <p className="text-xs text-slate-500">{modalFiltered.length} ຄົນ</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-100"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-3">
              <input
                type="text"
                placeholder="ຄົ້ນຫາຊື່, ລະຫັດ, ພະແນກ, ຕຳແໜ່ງ..."
                value={modalSearch}
                onChange={(e) => {
                  setModalSearch(e.target.value);
                  setPage(0);
                }}
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {paged.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  {modalSearch ? "ບໍ່ພົບຜົນ" : "ບໍ່ມີຄົນທີ່ສາມາດເພີ່ມໄດ້"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {paged.map((candidate) => (
                    <div key={candidate.employee_code} className={`flex items-center justify-between gap-3 ${itemClass}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{candidate.fullname_lo || candidate.employee_code}</p>
                        <p className="text-xs text-slate-500">
                          {candidate.position_name_lo || "-"} &middot; {candidate.department_name_lo || "-"} &middot; {candidate.employee_code}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAdd(candidate)}
                        disabled={loading === candidate.employee_code}
                        className={`${primaryButtonClass} shrink-0 px-3 py-1.5 text-xs font-semibold disabled:opacity-70`}
                      >
                        {loading === candidate.employee_code ? "..." : "ເພີ່ມ"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 disabled:text-slate-300"
                >
                  &larr; ກ່ອນ
                </button>
                <span className="text-xs text-slate-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 disabled:text-slate-300"
                >
                  ຕໍ່ &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
