"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { updateApplication, type FormState } from "../../actions";

export function StatusForm({
  id,
  status,
  note,
}: {
  id: string;
  status: string;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateApplication.bind(null, id),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <Field label="ສະຖານະ">
        <Combobox
          name="status"
          defaultValue={status}
          options={Object.entries(APPLICATION_STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
        />
      </Field>

      <Field label="ບັນທຶກພາຍໃນ (HR)">
        <textarea
          name="note"
          rows={4}
          defaultValue={note ?? ""}
          placeholder="ຄຳເຫັນຈາກການສຳພາດ, ຜົນການປະເມີນ ..."
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
      </Button>
    </form>
  );
}
