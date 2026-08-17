"use client";

import { useActionState, useState } from "react";
import { addApprovalStep, type ApproverFormState } from "./actions";
import { Button, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";

type Opt = { value: string; label: string };

export function ApprovalStepForm({ employees }: { employees: Opt[] }) {
  const [state, formAction, pending] = useActionState<ApproverFormState, FormData>(addApprovalStep, {});
  const [type, setType] = useState("UNIT_HEAD");
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <span className="mb-1 block text-xs text-muted">ປະເພດຜູ້ອະນຸມັດ</span>
        <select name="approverType" value={type} onChange={(e) => setType(e.target.value)} className={`${inputClass} w-56`}>
          <option value="UNIT_HEAD">ຫົວໜ້າໜ່ວຍງານ</option>
          <option value="DEPT_HEAD">ຜູ້ຈັດການພະແນກ</option>
          <option value="DIVISION_HEAD">ຫົວໜ້າຝ່າຍ</option>
          <option value="SPECIFIC">ຄົນສະເພາະ (ເຊັ່ນ ຜູ້ຈັດການ HR)</option>
        </select>
      </div>
      {type === "SPECIFIC" && (
        <div className="w-72">
          <span className="mb-1 block text-xs text-muted">ເລືອກຄົນ</span>
          <Combobox name="specificEmployeeCode" placeholder="— ເລືອກພະນັກງານ —" options={employees} />
        </div>
      )}
      <Button type="submit" disabled={pending}>{pending ? "..." : "+ ເພີ່ມຂັ້ນ"}</Button>
      {state.error && <p className="w-full text-sm text-rose-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-emerald-600">{state.success}</p>}
    </form>
  );
}
