"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createLeave, type LeaveFormState } from "./actions";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";

type LeaveTypeOpt = { id: string; name: string; requiresProof: boolean };

export function LeaveForm({ types }: { types: LeaveTypeOpt[] }) {
  const [state, formAction, pending] = useActionState<LeaveFormState, FormData>(
    createLeave,
    {},
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <Field label="ປະເພດການລາ" required hint={fe.leaveTypeId}>
        <Combobox
          name="leaveTypeId"
          placeholder="— ເລືອກ —"
          options={types.map((t) => ({
            value: t.id,
            label: `${t.name}${t.requiresProof ? " (ຕ້ອງມີໃບຢັ້ງຢືນ)" : ""}`,
          }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ວັນເລີ່ມ" required hint={fe.startDate}>
          <input type="date" name="startDate" className={inputClass} />
        </Field>
        <Field label="ວັນສິ້ນສຸດ" required hint={fe.endDate}>
          <input type="date" name="endDate" className={inputClass} />
        </Field>
      </div>

      <Field label="ເຫດຜົນ">
        <textarea name="reason" rows={3} className={inputClass} />
      </Field>

      <Field label="ລິ້ງໃບຢັ້ງຢືນ (ຖ້າມີ)" hint="ເຊັ່ນ ໃບແພດ — ວາງລິ້ງ Google Drive">
        <input name="proofUrl" className={inputClass} placeholder="https://..." />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຂໍ"}
        </Button>
        <Link
          href="/leave"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
        >
          ຍົກເລີກ
        </Link>
      </div>
    </form>
  );
}
