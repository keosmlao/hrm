"use client";

import { useActionState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_POSTING_STATUS_LABEL,
} from "@/lib/labels";
import { toInputDate } from "@/lib/format";
import type { FormState } from "../actions";
import type { PostingOptions } from "./options";

export type PostingValues = {
  title?: string;
  departmentCode?: string | null;
  positionCode?: string | null;
  employmentType?: string;
  location?: string | null;
  openings?: number;
  salaryRange?: string | null;
  description?: string | null;
  requirements?: string | null;
  status?: string;
  closingDate?: Date | string | null;
};

export function PostingForm({
  action,
  options,
  values = {},
  submitLabel = "ບັນທຶກ",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  options: PostingOptions;
  values?: PostingValues;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="ຊື່ຕຳແໜ່ງທີ່ຮັບສະໝັກ" required hint={err("title")}>
              <input name="title" defaultValue={values.title ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="ພະແນກ">
            <Combobox
              name="departmentCode"
              defaultValue={values.departmentCode ?? ""}
              placeholder="— ບໍ່ລະບຸ —"
              options={[
                { value: "", label: "— ບໍ່ລະບຸ —" },
                ...options.departments.map((d) => ({ value: d.code, label: d.name })),
              ]}
            />
          </Field>
          <Field label="ຕຳແໜ່ງອ້າງອີງ">
            <Combobox
              name="positionCode"
              defaultValue={values.positionCode ?? ""}
              placeholder="— ບໍ່ລະບຸ —"
              options={[
                { value: "", label: "— ບໍ່ລະບຸ —" },
                ...options.positions.map((p) => ({ value: p.code, label: p.name })),
              ]}
            />
          </Field>
          <Field label="ປະເພດການຈ້າງ" required>
            <Combobox
              name="employmentType"
              defaultValue={values.employmentType ?? "FULL_TIME"}
              options={Object.entries(EMPLOYMENT_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Field>
          <Field label="ຈຳນວນທີ່ຮັບ" required hint={err("openings")}>
            <input type="number" name="openings" min={1} defaultValue={values.openings ?? 1} className={inputClass} />
          </Field>
          <Field label="ສະຖານທີ່ເຮັດວຽກ">
            <input name="location" defaultValue={values.location ?? ""} placeholder="ເຊັ່ນ: ນະຄອນຫຼວງວຽງຈັນ" className={inputClass} />
          </Field>
          <Field label="ຊ່ວງເງິນເດືອນ">
            <input name="salaryRange" defaultValue={values.salaryRange ?? ""} placeholder="ເຊັ່ນ: 3,000,000 - 5,000,000 ກີບ" className={inputClass} />
          </Field>
          <Field label="ວັນປິດຮັບສະໝັກ">
            <input type="date" name="closingDate" defaultValue={toInputDate(values.closingDate)} className={inputClass} />
          </Field>
          <Field label="ສະຖານະ" required>
            <Combobox
              name="status"
              defaultValue={values.status ?? "DRAFT"}
              options={Object.entries(JOB_POSTING_STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <Field label="ໜ້າທີ່ຮັບຜິດຊອບ">
          <textarea name="description" rows={5} defaultValue={values.description ?? ""} className={inputClass} />
        </Field>
        <Field label="ຄຸນສົມບັດຜູ້ສະໝັກ">
          <textarea name="requirements" rows={5} defaultValue={values.requirements ?? ""} className={inputClass} />
        </Field>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "ກຳລັງບັນທຶກ..." : submitLabel}
      </Button>
    </form>
  );
}
