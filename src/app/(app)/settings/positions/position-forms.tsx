"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import {
  DEFAULT_POSITION_LEVEL,
  MANAGER_POSITION_LEVEL,
  POSITION_LEVELS,
} from "@/lib/position-level";
import { createPosition, type PositionFormState } from "./actions";

/**
 * ແນະນຳລະຫັດຖັດໄປ — ຮັກສາຮູບແບບເດີມທີ່ໃຊ້ຢູ່ (11, 12, 13 → 14)
 * ຖ້າຍັງບໍ່ມີຕຳແໜ່ງໃດ ຫຼື ລະຫັດເກົ່າບໍ່ແມ່ນຕົວເລກ ໃຫ້ເລີ່ມທີ່ "11"
 */
function suggestPositionCode(existingCodes: string[]): string {
  const numeric = existingCodes.filter((c) => /^\d+$/.test(c));
  if (numeric.length === 0) return "11";

  const taken = new Set(existingCodes);
  const width = Math.min(...numeric.map((c) => c.length));
  let next = Math.max(...numeric.map((c) => Number(c))) + 1;
  let candidate = String(next).padStart(width, "0");
  while (taken.has(candidate)) {
    next += 1;
    candidate = String(next).padStart(width, "0");
  }
  return candidate.slice(0, 20);
}

export function NewPositionForm({ positionCodes }: { positionCodes: string[] }) {
  const [state, formAction, pending] = useActionState<PositionFormState, FormData>(
    createPosition,
    {},
  );
  /** null = ຍັງບໍ່ໄດ້ພິມເອງ → ໃຊ້ລະຫັດທີ່ແນະນຳໃຫ້ */
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [handledSuccess, setHandledSuccess] = useState<string | undefined>();
  const [isManager, setIsManager] = useState(false);
  /** null = ຍັງບໍ່ໄດ້ເລືອກເອງ → ຕິດຕາມຊ່ອງ "ລະດັບຫົວໜ້າ" ໃຫ້ */
  const [pickedLevel, setPickedLevel] = useState<number | null>(null);

  const code = typedCode ?? suggestPositionCode(positionCodes);
  const level = pickedLevel ?? (isManager ? MANAGER_POSITION_LEVEL : DEFAULT_POSITION_LEVEL);

  // ບັນທຶກສຳເລັດ → React ລ້າງຊ່ອງທີ່ບໍ່ຄວບຄຸມໃຫ້ແລ້ວ ເຫຼືອລະຫັດທີ່ຕ້ອງກັບໄປໃຊ້ຄ່າແນະນຳໃໝ່
  if (state.success && state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    setTypedCode(null);
    setIsManager(false);
    setPickedLevel(null);
  }

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-4">
      <Field label="ລະຫັດຕຳແໜ່ງ" required hint="ແນະນຳໃຫ້ອັດຕະໂນມັດ ແກ້ໄດ້ · ສ້າງແລ້ວປ່ຽນບໍ່ໄດ້">
        <input
          name="code"
          required
          maxLength={20}
          value={code}
          onChange={(e) => setTypedCode(e.target.value.trim())}
          className={inputClass}
        />
      </Field>

      <Field label="ຊື່ຕຳແໜ່ງ (ລາວ)" required>
        <input name="nameLo" required maxLength={200} className={inputClass} />
      </Field>

      <Field label="ຊື່ຕຳແໜ່ງ (ອັງກິດ)">
        <input name="nameEn" maxLength={200} className={inputClass} />
      </Field>

      <Field label="ລະດັບຫົວໜ້າ" hint="ຄົນທີ່ຖືຕຳແໜ່ງນີ້ ເຂົ້າລະບົບເປັນສິດ MANAGER">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            name="isManager"
            type="checkbox"
            checked={isManager}
            onChange={(e) => setIsManager(e.target.checked)}
          />
          ເປັນຫົວໜ້າ / ຜູ້ຈັດການ
        </label>
      </Field>

      <Field label="ລະດັບຕຳແໜ່ງ" required hint="ໃຊ້ຈັດລຳດັບໃນຜັງອົງກອນ ແລະ ລາຍການຕຳແໜ່ງ">
        <select
          name="level"
          value={level}
          onChange={(e) => setPickedLevel(Number(e.target.value))}
          className={inputClass}
        >
          {POSITION_LEVELS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ລຳດັບແສດງ" hint="ນ້ອຍມາກ່ອນ — ໃຊ້ຈັດລຳດັບພາຍໃນລະດັບດຽວກັນ">
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={0} className={inputClass} />
      </Field>

      <div className="flex items-end md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "ກຳລັງບັນທຶກ..." : "+ ເພີ່ມຕຳແໜ່ງ"}
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
