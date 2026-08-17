"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { assignAsset, createAsset, previewAssetCode, type AssetFormState } from "./actions";

export function AssignAssetForm({
  assets,
  employees,
}: {
  assets: { code: string; name: string }[];
  employees: { code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AssetFormState, FormData>(assignAsset, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="ຊັບສິນ" required>
        <Combobox name="assetCode" required placeholder="— ເລືອກ —" options={assets.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))} />
      </Field>
      <Field label="ພະນັກງານ" required>
        <Combobox name="employeeCode" required placeholder="— ເລືອກ —" options={employees.map((e) => ({ value: e.code, label: `${e.code} · ${e.name}` }))} />
      </Field>
      <Field label="ວັນທີມອບ" required><input name="assignedDate" type="date" required className={inputClass} /></Field>
      <Field label="ສະພາບ"><input name="condition" placeholder="ໃໝ່ / ດີ / ມີຮອຍ" className={inputClass} /></Field>
      <Field label="ໝາຍເຫດ"><input name="note" className={inputClass} /></Field>
      {(state.error || state.success) && <p className={`self-end text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.success}</p>}
      <Button type="submit" disabled={pending} className="sm:col-span-2">{pending ? "ກຳລັງມອບ..." : "ມອບໃຫ້ພະນັກງານ"}</Button>
    </form>
  );
}

/**
 * ເພີ່ມຊັບສິນໃໝ່ — **ລະຫັດອອກໃຫ້ອັດຕະໂນມັດ** ຕາມປະເພດ (`200-00000379`).
 * ສະແດງລະຫັດທີ່ຈະໄດ້ລ່ວງໜ້າ ເພື່ອໃຫ້ຜູ້ໃຊ້ຮູ້ກ່ອນກົດບັນທຶກ.
 */
export function CreateAssetForm({
  types,
  locations,
  departments,
  branches,
}: {
  types: { code: string; name: string }[];
  locations: { code: string; name: string }[];
  departments: { code: string; name: string }[];
  branches: { code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AssetFormState, FormData>(createAsset, {});
  const [typeCode, setTypeCode] = useState(types[0]?.code ?? "");
  const [nextCode, setNextCode] = useState<string | null>(null);

  // ດຶງລະຫັດຖັດໄປ (ດຶງໃໝ່ຫຼັງສ້າງສຳເລັດ ເພື່ອໃຫ້ເລກຖືກຕ້ອງ)
  useEffect(() => {
    if (!typeCode) return;
    let alive = true;
    previewAssetCode(typeCode).then((c) => {
      if (alive) setNextCode(c);
    });
    return () => {
      alive = false;
    };
  }, [typeCode, state.success]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="ປະເພດ" required>
        <select
          name="typeCode"
          value={typeCode}
          onChange={(e) => setTypeCode(e.target.value)}
          className={inputClass}
          required
        >
          {types.map((t) => (
            <option key={t.code} value={t.code}>{t.code} · {t.name}</option>
          ))}
        </select>
      </Field>
      <Field label="ລະຫັດທີ່ຈະໄດ້">
        <input value={nextCode ?? "ກຳລັງຄິດ…"} readOnly className={`${inputClass} bg-slate-50 font-medium tabular`} />
      </Field>
      <Field label="ຊື່ຊັບສິນ" required><input name="name" required className={inputClass} /></Field>
      <Field label="ຫົວໜ່ວຍ"><input name="unitCode" placeholder="ເຄື່ອງ / ໜ່ວຍ" className={inputClass} /></Field>
      <Field label="ຍີ່ຫໍ້"><input name="brand" className={inputClass} /></Field>
      <Field label="ລຸ້ນ"><input name="modelInfo" className={inputClass} /></Field>
      <Field label="Serial number"><input name="serialNo" className={inputClass} /></Field>
      <Field label="ຜູ້ຖືຄອງ (ຂໍ້ຄວາມ)"><input name="holderName" className={inputClass} /></Field>
      <Field label="ບ່ອນຕັ້ງ">
        <select name="locationCode" className={inputClass}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="ສາຂາ">
        <select name="branchCode" className={inputClass}>
          <option value="">—</option>
          {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="ພະແນກ">
        <select name="departmentCode" className={inputClass}>
          <option value="">—</option>
          {departments.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
        </select>
      </Field>
      <Field label="ໝາຍເຫດ"><input name="remark" className={inputClass} /></Field>
      {(state.error || state.success) && (
        <p className={`text-sm sm:col-span-2 ${state.error ? "text-rose-600" : "text-emerald-600"}`}>
          {state.error ?? state.success}
        </p>
      )}
      <Button type="submit" disabled={pending} className="sm:col-span-2">
        {pending ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມຊັບສິນ"}
      </Button>
    </form>
  );
}
