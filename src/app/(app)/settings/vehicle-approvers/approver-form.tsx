"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { addVehicleApprover, type VehicleApproverState } from "./actions";

export function VehicleApproverForm({ employees }: { employees: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<VehicleApproverState, FormData>(addVehicleApprover, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="w-72">
        <Combobox name="employeeCode" placeholder="— ເລືອກພະນັກງານ —" options={employees} />
      </div>
      <Button disabled={pending}>{pending ? "..." : "+ ເພີ່ມ"}</Button>
      {(state.error || state.success) && <p className={`text-xs ${state.error ? "text-rose-600" : "text-emerald-700"}`}>{state.error ?? state.success}</p>}
    </form>
  );
}
