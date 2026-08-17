"use client";

import { useActionState } from "react";
import { createCycle } from "./actions";
import { Button, inputClass } from "@/components/ui";

export function CycleForm({ year }: { year: number }) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    createCycle,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium">ຊື່ຮອບ</span>
        <input
          name="name"
          placeholder="ເຊັ່ນ ປະເມີນກາງປີ"
          className={`${inputClass} w-56`}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">ປີ</span>
        <input name="year" type="number" defaultValue={year} className={`${inputClass} w-28`} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "+ ສ້າງຮອບ"}
      </Button>
      {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
    </form>
  );
}
