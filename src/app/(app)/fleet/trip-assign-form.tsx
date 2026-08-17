"use client";

import { useActionState } from "react";
import { assignTripVehicle, type FleetFormState } from "./actions";
import { Button, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";

type Opt = { value: string; label: string };

export function TripAssignForm({
  tripId,
  defaultTripNo,
  vehicles,
  employees,
}: {
  tripId: string;
  defaultTripNo: number;
  vehicles: Opt[];
  employees: Opt[];
}) {
  const action = assignTripVehicle.bind(null, tripId);
  const [state, formAction, pending] = useActionState<FleetFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted">
        ລົດ
        <div className="mt-1 w-44">
          <Combobox name="vehicleId" placeholder="— ເລືອກລົດ —" options={vehicles} />
        </div>
      </label>
      <label className="text-xs text-muted">
        ຄົນຂັບ
        <div className="mt-1 w-44">
          <Combobox name="driverCode" placeholder="— ບໍ່ລະບຸ —" options={[{ value: "", label: "— ບໍ່ລະບຸ —" }, ...employees]} />
        </div>
      </label>
      <label className="text-xs text-muted">
        ທິບ
        <input type="number" name="tripNo" min={1} defaultValue={defaultTripNo} className={`${inputClass} mt-1 w-16`} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "ຈັດລົດ + ອະນຸມັດ"}
      </Button>
      {state.error && <span className="w-full text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}
