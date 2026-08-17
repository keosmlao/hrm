"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ປະຕິທິນເລືອກຊ່ວງວັນທີ ດ້ວຍການ **ລາກເມົ້າ** ຈາກວັນເລີ່ມຫາວັນສິ້ນສຸດ.
 *
 * - ກົດຄ້າງແລ້ວລາກ → ເລືອກເປັນຊ່ວງ
 * - ກົດເທື່ອດຽວ (ບໍ່ລາກ) → ເລືອກວັນດຽວ
 * - ໃຊ້ pointer events ຈຶ່ງໃຊ້ໄດ້ທັງເມົ້າ ແລະ ໜ້າຈໍສຳຜັດ
 *
 * ຄ່າທີ່ສົ່ງອອກເປັນ "YYYY-MM-DD" ສະເໝີ ແລະ start ≤ end ສະເໝີ.
 */

const WEEKDAYS = ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສຸ", "ສ"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function laoToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

/** ວັນທັງໝົດຂອງເດືອນ + ຊ່ອງຫວ່າງກ່ອນວັນທຳອິດ ໃຫ້ຕົກຄໍລຳວັນຖືກ */
function monthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: ({ day: number; iso: string; weekday: number } | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) {
    cells.push({ day: d, iso: iso(year, month, d), weekday: new Date(Date.UTC(year, month - 1, d)).getUTCDay() });
  }
  return cells;
}

export function DateRangeCalendar({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = (start || laoToday()).split("-").map(Number);
    return { year: y, month: m };
  });
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const dragging = useRef(false);

  // ປ່ອຍເມົ້ານອກປະຕິທິນກໍຕ້ອງຈົບການລາກ ບໍ່ດັ່ງນັ້ນຈະຄ້າງ
  useEffect(() => {
    const stop = () => {
      dragging.current = false;
      setAnchor(null);
      setHover(null);
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const today = laoToday();
  const cells = monthCells(cursor.year, cursor.month);

  // ຊ່ວງທີ່ກຳລັງລາກຢູ່ (preview) ຫຼື ຊ່ວງທີ່ເລືອກໄວ້ແລ້ວ
  const previewFrom = anchor && hover ? (anchor <= hover ? anchor : hover) : start;
  const previewTo = anchor && hover ? (anchor <= hover ? hover : anchor) : end;

  function begin(day: string) {
    dragging.current = true;
    setAnchor(day);
    setHover(day);
    onChange(day, day);
  }

  function extend(day: string) {
    if (!dragging.current || !anchor) return;
    setHover(day);
    onChange(anchor <= day ? anchor : day, anchor <= day ? day : anchor);
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { ...c, month: m };
    });
  }

  return (
    <div className="select-none rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-slate-100"
          aria-label="ເດືອນກ່ອນ"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">
          {cursor.year}-{String(cursor.month).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-slate-100"
          aria-label="ເດືອນຕໍ່ໄປ"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-[11px] text-muted">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-1 font-semibold ${i === 0 ? "text-rose-500" : ""}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((c, i) => {
          if (!c) return <div key={`x${i}`} />;
          const inRange = previewFrom && previewTo && c.iso >= previewFrom && c.iso <= previewTo;
          const isEdge = c.iso === previewFrom || c.iso === previewTo;
          return (
            <button
              key={c.iso}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                begin(c.iso);
              }}
              onPointerEnter={() => extend(c.iso)}
              className={`h-9 rounded-md text-sm transition ${
                isEdge
                  ? "bg-primary font-semibold text-white"
                  : inRange
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-slate-100"
              } ${c.iso === today && !inRange ? "ring-1 ring-inset ring-primary" : ""} ${
                c.weekday === 0 && !inRange ? "text-rose-500" : ""
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[11px] text-muted">
        ກົດຄ້າງແລ້ວລາກ ເພື່ອເລືອກຫຼາຍວັນ · ກົດເທື່ອດຽວ = ວັນດຽວ
      </p>
    </div>
  );
}
