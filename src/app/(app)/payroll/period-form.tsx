"use client";

import { useActionState } from "react";
import { createPeriod } from "./actions";
import { Button, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { MONTH_LAO } from "@/lib/format";

export function PeriodForm({ year, month }: { year: number; month: number }) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    createPeriod,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium">ປີ</span>
        <input name="year" type="number" defaultValue={year} className={`${inputClass} w-28`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">ເດືອນ</span>
        <Combobox
          name="month"
          defaultValue={String(month)}
          className="w-40"
          options={MONTH_LAO.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "+ ສ້າງຮອບ"}
      </Button>
      {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
    </form>
  );
}
