"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { submitAttendanceCorrection, type CorrectionFormState } from "./actions";

export function CorrectionForm({
  employees,
  employeeCode,
  canChooseEmployee,
}: {
  employees: { code: string; name: string }[];
  employeeCode: string | null;
  canChooseEmployee: boolean;
}) {
  const [state, action, pending] = useActionState<CorrectionFormState, FormData>(submitAttendanceCorrection, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {canChooseEmployee ? (
        <Field label="ພະນັກງານ" required>
          <Combobox name="employeeCode" required options={employees.map((employee) => ({ value: employee.code, label: `${employee.code} · ${employee.name}` }))} />
        </Field>
      ) : (
        <input type="hidden" name="employeeCode" value={employeeCode ?? ""} />
      )}
      <Field label="ວັນທີເຮັດວຽກ" required><input name="workDate" type="date" required className={inputClass} /></Field>
      <Field label="ເວລາເຂົ້າໃໝ່"><input name="checkInTime" type="time" className={inputClass} /></Field>
      <Field label="ເວລາອອກໃໝ່"><input name="checkOutTime" type="time" className={inputClass} /></Field>
      <Field label="ເຫດຜົນ" required><input name="reason" required minLength={3} maxLength={500} className={inputClass} /></Field>
      <div className="sm:col-span-2 lg:col-span-4">
        {(state.error || state.success) && <p className={`text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.success}</p>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຂແກ້ໄຂ"}</Button>
    </form>
  );
}
