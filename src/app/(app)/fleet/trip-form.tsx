"use client";

import { useActionState, useEffect, useState } from "react";
import { createTrip, type FleetFormState } from "./actions";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { DateRangeCalendar } from "./date-range-calendar";
import { ShopPicker } from "./shop-picker";

type Opt = { value: string; label: string };
type AvailabilityTrip = {
  id: string;
  tripNo: number;
  destination: string;
  from: string;
  to: string;
  departTime: string | null;
  returnTime: string | null;
  status: string;
};
type Availability =
  | { kind: "checking" }
  | { kind: "free" }
  | { kind: "warning"; trips: AvailabilityTrip[] }
  | { kind: "blocked"; trips: AvailabilityTrip[] }
  | { kind: "error" };

export function TripForm({
  vehicles,
  employees,
  defaultDate,
  returnTo,
}: {
  vehicles: Opt[];
  employees: Opt[];
  defaultDate: string;
  /** ໜ້າທີ່ຈະກັບໄປຫຼັງສ້າງແລ້ວ — ບໍ່ໃສ່ = ໄປໜ້າລາຍການ trip ຕາມເດີມ */
  returnTo?: "trips" | "daily-slip";
}) {
  const [state, formAction, pending] = useActionState<FleetFormState, FormData>(createTrip, {});
  const [members, setMembers] = useState<string[]>([]);
  const [picker, setPicker] = useState("");
  // ວັນເລືອກຈາກປະຕິທິນ (ລາກໄດ້) · ເວລາແຍກເປັນຊ່ອງຕ່າງຫາກ
  const [date, setDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [departTime, setDepartTime] = useState("08:00");
  const [returnTime, setReturnTime] = useState("17:00");
  const [vehicleId, setVehicleId] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability({ kind: "checking" });
      try {
        const params = new URLSearchParams({ vehicleId, from: date, to: endDate });
        const response = await fetch(`/api/fleet/vehicle-availability?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("availability_failed");
        const result = (await response.json()) as {
          blocked: boolean;
          trips: AvailabilityTrip[];
        };
        if (result.blocked) setAvailability({ kind: "blocked", trips: result.trips });
        else if (result.trips.length) setAvailability({ kind: "warning", trips: result.trips });
        else setAvailability({ kind: "free" });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setAvailability({ kind: "error" });
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [vehicleId, date, endDate]);

  const empLabel = (code: string) => employees.find((e) => e.value === code)?.label ?? code;
  const addMember = (code: string) => {
    if (code && !members.includes(code)) setMembers((m) => [...m, code]);
    setPicker("");
  };

  return (
    <form action={formAction} className="space-y-4">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {members.map((code) => (
        <input key={code} type="hidden" name="member" value={code} />
      ))}
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="endDate" value={endDate} />
      <input type="hidden" name="departTime" value={departTime} />
      <input type="hidden" name="returnTime" value={returnTime} />

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div>
          <span className="mb-1.5 block text-sm font-medium">
            ວັນທີນຳໃຊ້ <span className="text-rose-600">*</span>
          </span>
          <DateRangeCalendar
            start={date}
            end={endDate}
            onChange={(s, e) => {
              setDate(s);
              setEndDate(e);
              setAvailability(null);
            }}
          />
          <p className="mt-1.5 text-xs text-muted">
            ເລືອກແລ້ວ:{" "}
            <strong className="text-foreground">
              {date === endDate ? date : `${date} → ${endDate}`}
            </strong>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ປະເພດ Trip" required>
          <Combobox name="tripType" defaultValue="SALE" options={[{ value: "SALE", label: "Sale Trip" }, { value: "GENERAL", label: "Trip ທົ່ວໄປ" }]} />
        </Field>
        <Field label="ເວລາອອກ" required>
          <input type="time" value={departTime} onChange={(e) => setDepartTime(e.target.value)} className={inputClass} />
        </Field>
        <Field label="ເວລາກັບ" required>
          <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputClass} />
        </Field>
        <Field label="ລົດ" required>
          <Combobox
            name="vehicleId"
            value={vehicleId}
            onChange={(value) => {
              setVehicleId(value);
              setAvailability(null);
            }}
            placeholder="— ເລືອກລົດ —"
            options={vehicles}
          />
          {availability?.kind === "checking" && (
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600">
              <span className="size-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              ກຳລັງກວດຕາຕະລາງລົດ…
            </span>
          )}
          {availability?.kind === "free" && (
            <span className="mt-1.5 block text-xs font-medium text-emerald-700">✓ ລົດວ່າງໃນຊ່ວງວັນທີນີ້</span>
          )}
          {availability?.kind === "error" && (
            <span className="mt-1.5 block text-xs text-amber-700">ກວດອັດຕະໂນມັດບໍ່ໄດ້ — ລະບົບຈະກວດອີກຄັ້ງຕອນບັນທຶກ</span>
          )}
        </Field>
        <Field label="ຄົນຂັບ">
          <Combobox name="driverCode" placeholder="— ເລືອກ —" options={[{ value: "", label: "— ບໍ່ລະບຸ —" }, ...employees]} />
        </Field>
        <Field label="ຕະຫຼາດ / ເສັ້ນທາງ" required>
          <input name="destination" placeholder="ເຊັ່ນ ຕະຫຼາດເຊົ້າ" className={inputClass} />
        </Field>
        <Field label="ໝາຍເຫດ">
          <input name="note" className={inputClass} />
        </Field>
        </div>
      </div>

      {(availability?.kind === "blocked" || availability?.kind === "warning") && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 ${
            availability.kind === "blocked"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="text-sm font-semibold">
            {availability.kind === "blocked"
              ? "ລົດຄັນນີ້ມີ Trip ທັບຊ້ອນ — ກະລຸນາເລືອກລົດຄັນອື່ນ"
              : "ລົດຄັນນີ້ມີ Trip ອື່ນໃນມື້ດຽວກັນ — ກະລຸນາກວດເວລາ"}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {availability.trips.map((trip) => (
              <li key={trip.id}>
                Trip #{trip.tripNo} · {trip.from === trip.to ? trip.from : `${trip.from} → ${trip.to}`}
                {trip.departTime || trip.returnTime ? ` · ${trip.departTime ?? "—"}–${trip.returnTime ?? "—"}` : ""}
                {` · ${trip.destination}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium">ພະນັກງານທີ່ໄປ</span>
        <div className="flex flex-wrap items-center gap-2">
          {members.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
              {empLabel(code)}
              <button type="button" onClick={() => setMembers((m) => m.filter((c) => c !== code))} className="text-primary/60 hover:text-primary">
                ×
              </button>
            </span>
          ))}
          <div className="w-56">
            <Combobox
              value={picker}
              onChange={addMember}
              placeholder="+ ເພີ່ມພະນັກງານ"
              options={employees.filter((e) => !members.includes(e.value))}
            />
          </div>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          ຮ້ານຄ້າທີ່ຈະໄປ <span className="text-xs font-normal text-muted">(Sale Trip · ຈາກ ar_customer)</span>
        </span>
        <ShopPicker />
      </div>

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      <Button
        type="submit"
        disabled={pending || availability?.kind === "checking" || availability?.kind === "blocked"}
      >
        {pending
          ? "ກຳລັງບັນທຶກ..."
          : availability?.kind === "blocked"
            ? "ລົດບໍ່ວ່າງ"
            : "+ ເພີ່ມ trip"}
      </Button>
    </form>
  );
}
