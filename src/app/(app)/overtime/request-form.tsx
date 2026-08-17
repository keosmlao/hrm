"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { createOvertime, type OvertimeFormState } from "./actions";
import type { OvertimeRatePolicy } from "@/lib/overtime-settings";

export function OvertimeRequestForm({ rates }: { rates: OvertimeRatePolicy }) {
  const [state, formAction, pending] = useActionState<OvertimeFormState, FormData>(
    createOvertime,
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="ວັນທີ OT" required hint={errors.workDate}>
        <input name="workDate" type="date" required className={inputClass} />
      </Field>
      <Field label="ເລີ່ມ" required hint={errors.startTime}>
        <input name="startTime" type="time" required className={inputClass} />
      </Field>
      <Field label="ສິ້ນສຸດ" required hint={errors.endTime}>
        <input name="endTime" type="time" required className={inputClass} />
      </Field>
      <Field label="ເຫດຜົນ" hint={errors.reason}>
        <input name="reason" maxLength={500} className={inputClass} />
      </Field>
      {state.error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 md:col-span-2 xl:col-span-4">
          {state.error}
        </p>
      )}
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຂໍ OT"}
        </Button>
      </div>
      <p className="text-xs text-muted md:col-span-2 xl:col-span-4">
        ລະບົບເລືອກອັດຕາອັດຕະໂນມັດ: ວັນປົກກະຕິ {rates.workdayRate}× · ວັນພັກຕາມຕາຕະລາງ {rates.dayOffRate}× · ວັນພັກບໍລິສັດ {rates.holidayRate}×
      </p>
    </form>
  );
}
