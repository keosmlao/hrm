"use client";

import { useState } from "react";
import { TripForm } from "./trip-form";

type Opt = { value: string; label: string };

export function TripCreateModal({
  vehicles,
  employees,
  defaultDate,
  returnTo,
  label = "+ ເພີ່ມ trip",
  title = "ເພີ່ມ trip",
}: {
  vehicles: Opt[];
  employees: Opt[];
  defaultDate: string;
  /** ຂໍ້ຄວາມເທິງປຸ່ມ — ໜ້າໃບນຳໃຊ້ລົດເອີ້ນມັນວ່າ "ສ້າງໃບນຳໃຊ້ລົດ" */
  label?: string;
  title?: string;
  returnTo?: "trips" | "daily-slip";
}) {
  const [open, setOpen] = useState(false);

  if (vehicles.length === 0) {
    return <p className="text-sm text-muted">ຍັງບໍ່ມີຂໍ້ມູນລົດໃນລະບົບ ERP</p>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-muted hover:bg-slate-100" aria-label="ປິດ">✕</button>
            </div>
            <TripForm vehicles={vehicles} employees={employees} defaultDate={defaultDate} returnTo={returnTo} />
          </div>
        </div>
      )}
    </>
  );
}
