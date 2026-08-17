"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { saveMonthlyRoster, type RosterFormState } from "./actions";

const DAY_LABELS = ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສ", "ສອ"];

export function RosterEditor({
  employeeCode,
  month,
  initialDaysOff,
  holidays,
}: {
  employeeCode: string;
  month: string;
  initialDaysOff: string[];
  holidays: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<RosterFormState, FormData>(saveMonthlyRoster, {});
  const [selected, setSelected] = useState(() => new Set(initialDaysOff));
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return { day, date, dow: new Date(`${date}T00:00:00Z`).getUTCDay() };
  });

  function toggle(date: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <form action={action}>
      <input type="hidden" name="employeeCode" value={employeeCode} />
      <input type="hidden" name="month" value={month} />
      {[...selected].map((date) => <input key={date} type="hidden" name="dayOff" value={date} />)}
      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted">
        {DAY_LABELS.map((label) => <div key={label} className="py-2">{label}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: firstDow }, (_, index) => <div key={`empty-${index}`} />)}
        {days.map(({ day, date, dow }) => {
          const isOff = selected.has(date);
          const holiday = holidays[date];
          return (
            <button
              key={date}
              type="button"
              onClick={() => toggle(date)}
              className={`min-h-20 rounded-lg border p-2 text-left transition ${
                isOff
                  ? "border-rose-300 bg-rose-50 text-rose-800"
                  : holiday
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-semibold">{day}</span>
              <span className="mt-1 block text-[10px] leading-tight">
                {isOff ? "ວັນພັກ" : holiday ?? (dow === 0 || dow === 6 ? "ທ້າຍອາທິດ" : "ເຮັດວຽກ")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">ເລືອກແລ້ວ <strong className="text-foreground">{selected.size}</strong> ວັນ</p>
        <div className="flex items-center gap-3">
          {(state.error || state.success) && <p className={`text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.success}</p>}
          <Button type="submit" disabled={pending}>{pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຕາຕະລາງ"}</Button>
        </div>
      </div>
    </form>
  );
}
