"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiDelete, apiFetch, apiPost } from "@/lib/api";
import { AuroraBackground } from "@/app/home/page";

interface Organizer { employeeCode: string; employeeName: string; assignedAt: string; }
interface Employee { employeeCode: string; displayName: string; departmentName: string | null; }

interface PageData {
  viewer: { employeeCode: string; displayName: string; isIT: boolean; isOrganizer: boolean };
  organizers: Organizer[];
  employees: Employee[];
}

interface Notice { tone: "success" | "error"; message: string; }

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageData | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PageData>("/page-data/settings")
      .then(setData)
      .catch((e) => { if (e instanceof ApiError && e.status === 401) router.replace("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  const reload = async (msg?: string) => {
    const next = await apiFetch<PageData>("/page-data/settings");
    setData(next);
    if (msg) setNotice({ tone: "success", message: msg });
  };

  const handleAdd = async (code: string) => {
    setAdding(code);
    setNotice(null);
    try {
      await apiPost("/meetings/organizers", { employeeCode: code });
      setSearch("");
      await reload("ເພີ່ມຜູ້ຈັດປະຊຸມແລ້ວ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດເພີ່ມໄດ້" });
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (code: string) => {
    setNotice(null);
    try {
      await apiDelete("/meetings/organizers", { employeeCode: code });
      await reload("ລົບຜູ້ຈັດປະຊຸມແລ້ວ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດລົບໄດ້" });
    }
  };

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

  if (!data.viewer.isIT) {
    return (
      <div className="aurora-page min-h-screen text-slate-900">
        <AuroraBackground />
        <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-8 text-center shadow-lg backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F65AB]">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800">ບໍ່ສາມາດເຂົ້າເຖິງ</h2>
            <p className="mt-2 text-sm text-slate-500">ໜ້າຕັ້ງຄ່ານີ້ສະເພາະ IT</p>
            <Link href="/home" className="mt-5 inline-flex rounded-xl bg-[#2F65AB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#265189]">
              ກັບໜ້າຫຼັກ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const organizerCodes = new Set(data.organizers.map((o) => o.employeeCode));
  const filteredEmployees = search.trim()
    ? data.employees
        .filter((e) => !organizerCodes.has(e.employeeCode))
        .filter((e) => e.displayName.includes(search) || e.employeeCode.includes(search) || e.departmentName?.includes(search))
    : [];

  return (
    <div className="aurora-page min-h-screen text-slate-900">
      <AuroraBackground />

      <header className="px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 shadow-lg shadow-black/[0.03] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F65AB] shadow-sm">
              <SettingsIcon className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">IT Only</p>
              <p className="text-sm font-bold text-slate-800">ຕັ້ງຄ່າລະບົບ</p>
            </div>
          </div>
          <Link href="/home" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-[#2F65AB]/5 hover:text-[#2F65AB]">
            ກັບໜ້າຫຼັກ
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <div className="space-y-6">

          {notice && (
            <div className={cn("rounded-2xl border px-4 py-3 text-sm font-medium", notice.tone === "success" ? "border-emerald-200 bg-emerald-50/80 text-emerald-700" : "border-rose-200 bg-rose-50/80 text-rose-700")}>
              {notice.message}
            </div>
          )}

          {/* Meeting organizers */}
          <section className="rounded-3xl border border-white/60 bg-white/65 shadow-lg shadow-black/[0.04] backdrop-blur-xl">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h3 className="text-base font-bold text-slate-800">ຜູ້ຈັດຕາຕະລາງປະຊຸມ</h3>
              <p className="mt-0.5 text-xs text-slate-400">ກຳນົດພະນັກງານທີ່ມີສິດສ້າງ ແລະ ນັດປະຊຸມໃນລະບົບ</p>
            </div>

            <div className="px-5 py-5 sm:px-6">
              {/* Search to add */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">ເພີ່ມຜູ້ຈັດປະຊຸມ</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາພະນັກງານ (ຊື່ ຫຼື ລະຫັດ)..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20"
                />

                {filteredEmployees.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-white">
                    {filteredEmployees.slice(0, 15).map((emp) => (
                      <button
                        key={emp.employeeCode}
                        type="button"
                        disabled={adding === emp.employeeCode}
                        onClick={() => { void handleAdd(emp.employeeCode); }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#2F65AB]/5 disabled:opacity-60"
                      >
                        <div>
                          <span className="font-medium text-slate-700">{emp.displayName}</span>
                          <span className="ml-2 text-xs text-slate-400">{emp.employeeCode}</span>
                          {emp.departmentName && <span className="ml-1 text-xs text-slate-300">· {emp.departmentName}</span>}
                        </div>
                        <span className="shrink-0 rounded-lg bg-[#2F65AB] px-2.5 py-1 text-xs font-semibold text-white">
                          {adding === emp.employeeCode ? "..." : "ເພີ່ມ"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current organizers */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">ຜູ້ຈັດປະຊຸມປັດຈຸບັນ</p>
                  <span className="text-xs text-slate-400">{data.organizers.length} ຄົນ</span>
                </div>

                {data.organizers.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    ຍັງບໍ່ມີຜູ້ຈັດປະຊຸມ — ຄົ້ນຫາ ແລະ ເພີ່ມຂ້າງເທິງ
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.organizers.map((o) => (
                      <div key={o.employeeCode} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{o.employeeName}</p>
                          <p className="text-[0.65rem] text-slate-400">{o.employeeCode} · ເພີ່ມເມື່ອ {formatDate(o.assignedAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { void handleRemove(o.employeeCode); }}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-50"
                        >
                          ລົບ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

/* ===== Helpers ===== */

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/* ===== Icons ===== */

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.2 12.2a1.2 1.2 0 0 0 .24 1.32l.04.04a1.46 1.46 0 1 1-2.06 2.06l-.04-.04a1.2 1.2 0 0 0-1.32-.24 1.2 1.2 0 0 0-.73 1.1v.12a1.46 1.46 0 0 1-2.92 0v-.06a1.2 1.2 0 0 0-.78-1.1 1.2 1.2 0 0 0-1.32.24l-.04.04a1.46 1.46 0 1 1-2.06-2.06l.04-.04a1.2 1.2 0 0 0 .24-1.32 1.2 1.2 0 0 0-1.1-.73h-.12a1.46 1.46 0 0 1 0-2.92h.06a1.2 1.2 0 0 0 1.1-.78 1.2 1.2 0 0 0-.24-1.32l-.04-.04a1.46 1.46 0 1 1 2.06-2.06l.04.04a1.2 1.2 0 0 0 1.32.24h.06a1.2 1.2 0 0 0 .73-1.1v-.12a1.46 1.46 0 0 1 2.92 0v.06a1.2 1.2 0 0 0 .73 1.1 1.2 1.2 0 0 0 1.32-.24l.04-.04a1.46 1.46 0 1 1 2.06 2.06l-.04.04a1.2 1.2 0 0 0-.24 1.32v.06a1.2 1.2 0 0 0 1.1.73h.12a1.46 1.46 0 0 1 0 2.92h-.06a1.2 1.2 0 0 0-1.1.73Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
