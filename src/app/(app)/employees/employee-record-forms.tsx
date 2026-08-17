"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import {
  createContract,
  createEmployeeDocument,
  type RecordFormState,
} from "./actions";

function Message({ state }: { state: RecordFormState }) {
  if (!state.error && !state.success) return null;
  return <p className={`text-sm md:col-span-2 ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.success}</p>;
}

export function ContractForm({ employeeCode }: { employeeCode: string }) {
  const [state, action, pending] = useActionState<RecordFormState, FormData>(
    createContract.bind(null, employeeCode),
    {},
  );
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <Field label="ເລກສັນຍາ" required><input name="contractNo" required className={inputClass} /></Field>
      <Field label="ປະເພດ" required><Combobox name="type" defaultValue="PERMANENT" options={[{ value: "PROBATION", label: "ທົດລອງງານ" }, { value: "FIXED_TERM", label: "ມີກຳນົດ" }, { value: "PERMANENT", label: "ບໍ່ມີກຳນົດ" }, { value: "PART_TIME", label: "ບາງເວລາ" }, { value: "INTERNSHIP", label: "ຝຶກງານ" }]} /></Field>
      <Field label="ວັນເລີ່ມ" required><input name="startDate" type="date" required className={inputClass} /></Field>
      <Field label="ວັນສິ້ນສຸດ"><input name="endDate" type="date" className={inputClass} /></Field>
      <Field label="ເງິນເດືອນ" required><input name="salary" type="number" min="0" step="1000" required className={inputClass} /></Field>
      <Field label="ລິ້ງໄຟລ໌ສັນຍາ"><input name="fileUrl" type="url" placeholder="https://..." className={inputClass} /></Field>
      <Field label="ໝາຍເຫດ"><input name="note" className={inputClass} /></Field>
      <Message state={state} />
      <Button type="submit" disabled={pending} className="md:col-span-2">{pending ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມສັນຍາ"}</Button>
    </form>
  );
}

export function EmployeeDocumentForm({ employeeCode }: { employeeCode: string }) {
  const [state, action, pending] = useActionState<RecordFormState, FormData>(
    createEmployeeDocument.bind(null, employeeCode),
    {},
  );
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <Field label="ຊື່ເອກະສານ" required><input name="name" required className={inputClass} /></Field>
      <Field label="ປະເພດ"><input name="type" placeholder="ບັດປະຈຳຕົວ / ໃບຢັ້ງຢືນ" className={inputClass} /></Field>
      <Field label="URL ໄຟລ໌" required><input name="fileUrl" type="url" required placeholder="https://..." className={inputClass} /></Field>
      <Field label="ວັນໝົດອາຍຸ"><input name="expiryDate" type="date" className={inputClass} /></Field>
      <Message state={state} />
      <Button type="submit" disabled={pending} className="md:col-span-2">{pending ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມເອກະສານ"}</Button>
    </form>
  );
}
