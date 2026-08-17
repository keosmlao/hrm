"use client";

import { useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { DateRangeCalendar } from "./date-range-calendar";
import { updateTrip, removeTrip } from "./actions";

type Opt = { value: string; label: string };

export function TripEditActions({
  tripId,
  editable,
  defaults,
  vehicles,
  employees,
}: {
  tripId: string;
  editable: boolean;
  defaults: { destination: string; date: string; endDate: string; departTime: string; returnTime: string; vehicleId: string; driverCode: string; note: string };
  vehicles: Opt[];
  employees: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(defaults.date);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [departTime, setDepartTime] = useState(defaults.departTime || "08:00");
  const [returnTime, setReturnTime] = useState(defaults.returnTime || "17:00");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null);
    const result = await updateTrip(tripId, {}, new FormData(event.currentTarget));
    setBusy(false);
    if (result.error) setError(result.error);
    else setOpen(false);
  };

  return (
    <div className="flex items-center gap-3">
      {editable && <button onClick={() => setOpen(true)} className="text-sm text-primary hover:underline">ແກ້ໄຂ</button>}
      <form action={removeTrip.bind(null, tripId)} onSubmit={(e) => { if (!confirm("ລົບ Trip ນີ້ທັງໝົດ? ຂໍ້ມູນຮ້ານ, ການຂາຍ, ຄ່າໃຊ້ຈ່າຍ ຈະຖືກລົບນຳ — ກູ້ຄືນບໍ່ໄດ້.")) e.preventDefault(); }}>
        <button className="text-sm text-rose-600 hover:underline">ລົບ</button>
      </form>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="mt-10 w-full max-w-2xl rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">ແກ້ໄຂ Trip</h2>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="endDate" value={endDate} />
              <input type="hidden" name="departTime" value={departTime} />
              <input type="hidden" name="returnTime" value={returnTime} />

              <div>
                <span className="mb-1.5 block text-sm font-medium">
                  ວັນທີນຳໃຊ້ <span className="text-rose-600">*</span>
                </span>
                <DateRangeCalendar
                  start={date}
                  end={endDate}
                  onChange={(s, e) => { setDate(s); setEndDate(e); }}
                />
                <p className="mt-1.5 text-xs text-muted">
                  ເລືອກແລ້ວ: <strong className="text-foreground">{date === endDate ? date : `${date} → ${endDate}`}</strong>
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ເວລາອອກ" required>
                  <input type="time" value={departTime} onChange={(e) => setDepartTime(e.target.value)} className={inputClass} />
                </Field>
                <Field label="ເວລາກັບ" required>
                  <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputClass} />
                </Field>
                <Field label="ລົດ" required>
                  <Combobox name="vehicleId" defaultValue={defaults.vehicleId} placeholder="— ເລືອກລົດ —" options={vehicles} />
                </Field>
                <Field label="ຄົນຂັບ">
                  <Combobox name="driverCode" defaultValue={defaults.driverCode} placeholder="— ເລືອກ —" options={[{ value: "", label: "— ບໍ່ລະບຸ —" }, ...employees]} />
                </Field>
                <Field label="ຕະຫຼາດ / ເສັ້ນທາງ" required>
                  <input name="destination" defaultValue={defaults.destination} placeholder="ເຊັ່ນ ຕະຫຼາດເຊົ້າ" className={inputClass} />
                </Field>
                <Field label="ໝາຍເຫດ">
                  <input name="note" defaultValue={defaults.note} className={inputClass} />
                </Field>
              </div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={busy}>{busy ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}</Button>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">ຍົກເລີກ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
