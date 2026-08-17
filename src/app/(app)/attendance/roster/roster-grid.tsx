"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { saveRosterGrid, type RosterFormState } from "./actions";

const DOW = ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສ", "ສອ"];

/** ຕາຕະລາງລວມ: ພະນັກງານ (ແຖວ) × ວັນ (ຖັນ) — ຄລິກຊ່ອງເພື່ອຕິກວັນພັກ */
export function RosterGrid({
  employees,
  month,
  initial,
  holidays,
}: {
  employees: { code: string; name: string }[];
  month: string;
  initial: Record<string, string[]>;
  holidays: Record<string, string>;
}) {
  const [year, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { day, date, dow, holiday: holidays[date] };
  });

  const [state, setState] = useState<RosterFormState>({});
  const [pending, start] = useTransition();
  const [grid, setGrid] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    for (const e of employees) m.set(e.code, new Set(initial[e.code] ?? []));
    return m;
  });

  function toggle(code: string, date: string) {
    setGrid((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(code) ?? []);
      if (set.has(date)) set.delete(date);
      else set.add(date);
      next.set(code, set);
      return next;
    });
  }

  // ຕິກ/ຍົກເລີກ ທັງຖັນ (ວັນດຽວກັນ ໃຫ້ທຸກຄົນ)
  function toggleColumn(date: string) {
    setGrid((prev) => {
      const next = new Map(prev);
      const allOff = employees.every((e) => next.get(e.code)?.has(date));
      for (const e of employees) {
        const set = new Set(next.get(e.code) ?? []);
        if (allOff) set.delete(date);
        else set.add(date);
        next.set(e.code, set);
      }
      return next;
    });
  }

  // ຕິກ/ຍົກເລີກ ທັງແຖວ (ທຸກວັນ ຂອງຄົນດຽວ)
  function toggleRow(code: string) {
    setGrid((prev) => {
      const next = new Map(prev);
      const set = next.get(code) ?? new Set<string>();
      const allDates = days.map((d) => d.date);
      const allOff = allDates.every((d) => set.has(d));
      next.set(code, allOff ? new Set() : new Set(allDates));
      return next;
    });
  }

  function save() {
    const entries = employees.map((e) => ({
      employeeCode: e.code,
      dates: [...(grid.get(e.code) ?? [])],
    }));
    start(async () => setState(await saveRosterGrid(month, entries)));
  }

  const total = [...grid.values()].reduce((s, set) => s + set.size, 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-border bg-slate-50 px-3 py-2 text-left font-semibold text-muted">
                ພະນັກງານ
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  className={`w-8 border-b border-border p-0 font-medium ${
                    d.holiday
                      ? "bg-amber-50 text-amber-700"
                      : d.dow === 0 || d.dow === 6
                        ? "bg-slate-100 text-slate-500"
                        : "bg-slate-50 text-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumn(d.date)}
                    title={d.holiday ? `${d.holiday} — ຕິກທັງຖັນ` : "ຕິກ/ຍົກເລີກ ທັງຖັນ"}
                    className="w-full py-1 transition hover:bg-primary/10"
                  >
                    <div className="tabular-nums">{d.day}</div>
                    <div className="text-[9px] font-normal">{DOW[d.dow]}</div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="px-3 py-10 text-center text-muted">
                  ບໍ່ພົບພະນັກງານ
                </td>
              </tr>
            )}
            {employees.map((e) => {
              const set = grid.get(e.code) ?? new Set<string>();
              return (
                <tr key={e.code} className="border-t border-border">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-card p-0 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleRow(e.code)}
                      title="ຕິກ/ຍົກເລີກ ທັງແຖວ"
                      className="w-full px-3 py-1.5 text-left transition hover:text-primary"
                    >
                      {e.name}
                    </button>
                  </td>
                  {days.map((d) => {
                    const off = set.has(d.date);
                    return (
                      <td key={d.date} className="p-0 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(e.code, d.date)}
                          aria-label={`${e.name} ${d.date}`}
                          className={`h-7 w-8 border-l border-border/50 text-center transition ${
                            off
                              ? "bg-rose-500 font-semibold text-white"
                              : d.holiday
                                ? "bg-amber-50 hover:bg-amber-100"
                                : d.dow === 0 || d.dow === 6
                                  ? "bg-slate-50 hover:bg-slate-100"
                                  : "hover:bg-primary/10"
                          }`}
                        >
                          {off ? "×" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          ວັນພັກລວມ <strong className="text-foreground">{total}</strong> · ຄລິກຊ່ອງເພື່ອຕິກ/ຍົກເລີກວັນພັກ
        </p>
        <div className="flex items-center gap-3">
          {(state.error || state.success) && (
            <p className={`text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>
              {state.error ?? state.success}
            </p>
          )}
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຕາຕະລາງ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
