"use client";

/**
 * ປຸ່ມຂອງລາຍງານ: ພິມ/ບັນທຶກ PDF ແລະ ດາວໂຫຼດ CSV
 * (CSV ສ້າງຈາກແຖວທີ່ server ກຽມໃຫ້ແລ້ວ — ບໍ່ຕ້ອງເອີ້ນ GPS ຄືນ)
 */
export function ReportActions({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
}) {
  const csv = () => {
    const cell = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // ﻿ = BOM ໃຫ້ Excel ອ່ານພາສາລາວຖືກ
    const body = "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 print:hidden">
      <button
        type="button"
        onClick={csv}
        className="rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/20"
      >
        ⬇ CSV
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/20"
      >
        🖨 ພິມ / PDF
      </button>
    </div>
  );
}
