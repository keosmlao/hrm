"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { createUnit, type UnitFormState } from "./actions";

export type DivisionOpt = { code: string; name: string };
export type DepartmentOpt = { code: string; name: string; divisionCode: string };

/**
 * ແນະນຳລະຫັດຖັດໄປຂອງພະແນກ — ຮັກສາຮູບແບບເດີມທີ່ໃຊ້ຢູ່ (204 → 2041, 101 → 10101)
 * ຖ້າພະແນກຍັງບໍ່ມີໜ່ວຍງານ ໃຫ້ເລີ່ມທີ່ "01"
 */
function suggestUnitCode(departmentCode: string, existingCodes: string[]): string {
  if (!departmentCode) return "";
  const taken = new Set(existingCodes);
  const suffixes = existingCodes
    .filter((c) => c.startsWith(departmentCode) && c.length > departmentCode.length)
    .map((c) => c.slice(departmentCode.length))
    .filter((s) => /^\d+$/.test(s));

  let width = 2;
  let next = 1;
  if (suffixes.length) {
    width = Math.min(...suffixes.map((s) => s.length));
    next = Math.max(...suffixes.map((s) => Number(s))) + 1;
  }
  let candidate = departmentCode + String(next).padStart(width, "0");
  while (taken.has(candidate)) {
    next += 1;
    candidate = departmentCode + String(next).padStart(width, "0");
  }
  return candidate.slice(0, 20);
}

export function NewUnitForm({
  divisions,
  departments,
  unitCodes,
}: {
  divisions: DivisionOpt[];
  departments: DepartmentOpt[];
  unitCodes: string[];
}) {
  const [state, formAction, pending] = useActionState<UnitFormState, FormData>(createUnit, {});
  const [divisionCode, setDivisionCode] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  /** null = ຍັງບໍ່ໄດ້ພິມເອງ → ໃຊ້ລະຫັດທີ່ແນະນຳໃຫ້ */
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [handledSuccess, setHandledSuccess] = useState<string | undefined>();

  const code = typedCode ?? suggestUnitCode(departmentCode, unitCodes);

  // ບັນທຶກສຳເລັດ → React ລ້າງຊ່ອງທີ່ບໍ່ຄວບຄຸມໃຫ້ແລ້ວ ເຫຼືອລະຫັດທີ່ຕ້ອງກັບໄປໃຊ້ຄ່າແນະນຳໃໝ່
  if (state.success && state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    setTypedCode(null);
  }

  const visibleDepartments = divisionCode
    ? departments.filter((d) => d.divisionCode === divisionCode)
    : departments;

  function pickDivision(next: string) {
    setDivisionCode(next);
    if (departmentCode && !departments.some((d) => d.code === departmentCode && d.divisionCode === next)) {
      setDepartmentCode("");
    }
  }

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-4">
      <Field label="ຝ່າຍ" hint="ໃຊ້ກັ່ນຕອງລາຍການພະແນກ">
        <Combobox
          value={divisionCode}
          onChange={pickDivision}
          placeholder="— ທັງໝົດ —"
          options={[
            { value: "", label: "— ທັງໝົດ —" },
            ...divisions.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` })),
          ]}
        />
      </Field>

      <Field label="ພະແນກ" required>
        <Combobox
          key={divisionCode}
          name="departmentCode"
          value={departmentCode}
          onChange={setDepartmentCode}
          placeholder="— ເລືອກພະແນກ —"
          options={[
            { value: "", label: "— ເລືອກພະແນກ —" },
            ...visibleDepartments.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` })),
          ]}
        />
      </Field>

      <Field label="ລະຫັດໜ່ວຍງານ" required hint="ແນະນຳໃຫ້ອັດຕະໂນມັດ ແກ້ໄດ້ · ສ້າງແລ້ວປ່ຽນບໍ່ໄດ້">
        <input
          name="code"
          required
          maxLength={20}
          value={code}
          onChange={(e) => setTypedCode(e.target.value.trim())}
          className={inputClass}
        />
      </Field>

      <Field label="ຊື່ໜ່ວຍງານ (ລາວ)" required>
        <input name="nameLo" required maxLength={200} className={inputClass} />
      </Field>

      <Field label="ຊື່ໜ່ວຍງານ (ອັງກິດ)">
        <input name="nameEn" maxLength={200} className={inputClass} />
      </Field>

      <div className="flex items-end md:col-span-3">
        <Button type="submit" disabled={pending || !departmentCode}>
          {pending ? "ກຳລັງບັນທຶກ..." : "+ ເພີ່ມໜ່ວຍງານ"}
        </Button>
      </div>

      {(state.error || state.success) && (
        <p className={`md:col-span-4 text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>
          {state.error ?? state.success}
        </p>
      )}
    </form>
  );
}
