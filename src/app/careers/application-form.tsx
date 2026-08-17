"use client";

import { useActionState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { GENDER_LABEL } from "@/lib/labels";
import { submitApplication, type ApplyState } from "./actions";

export function ApplicationForm({
  posting,
}: {
  /** ຖ້າສະໝັກຜ່ານປະກາດໃດໜຶ່ງ — ຈະ lock ຕຳແໜ່ງໄວ້ */
  posting?: { id: string; title: string };
}) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(
    submitApplication,
    {},
  );
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-6">
      {posting && <input type="hidden" name="jobPostingId" value={posting.id} />}

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">ຂໍ້ມູນຜູ້ສະໝັກ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ຊື່ ແລະ ນາມສະກຸນ" required hint={err("fullname")}>
            <input name="fullname" className={inputClass} />
          </Field>
          <Field label="ເບີໂທຕິດຕໍ່" required hint={err("phone")}>
            <input name="phone" inputMode="tel" className={inputClass} />
          </Field>
          <Field label="ອີເມວ" hint={err("email")}>
            <input name="email" type="email" className={inputClass} />
          </Field>
          {posting ? (
            <Field label="ຕຳແໜ່ງທີ່ສະໝັກ">
              <input
                value={posting.title}
                readOnly
                className={`${inputClass} bg-slate-50 text-muted`}
              />
            </Field>
          ) : (
            <Field label="ຕຳແໜ່ງທີ່ສົນໃຈ">
              <input
                name="positionApplied"
                placeholder="ເຊັ່ນ: ພະນັກງານບັນຊີ"
                className={inputClass}
              />
            </Field>
          )}
          <Field label="ເພດ">
            <Combobox
              name="gender"
              defaultValue=""
              options={[
                { value: "", label: "— ເລືອກ —" },
                ...Object.entries(GENDER_LABEL).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />
          </Field>
          <Field label="ວັນເດືອນປີເກີດ">
            <input type="date" name="dob" className={inputClass} />
          </Field>
          <Field label="ທີ່ຢູ່ປັດຈຸບັນ">
            <input name="address" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">ຄຸນວຸດທິ ແລະ ປະສົບການ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ລະດັບການສຶກສາ">
            <input
              name="education"
              placeholder="ເຊັ່ນ: ປະລິນຍາຕີ ບໍລິຫານທຸລະກິດ"
              className={inputClass}
            />
          </Field>
          <Field label="ເງິນເດືອນທີ່ຄາດຫວັງ (ກີບ)" hint={err("expectedSalary")}>
            <input
              type="number"
              name="expectedSalary"
              min={0}
              step={100000}
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="ປະສົບການເຮັດວຽກ">
              <textarea
                name="experience"
                rows={3}
                placeholder="ສະຫຼຸບປະສົບການ ແລະ ບ່ອນເຮັດວຽກທີ່ຜ່ານມາ"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="ລິ້ງ CV / Resume"
              hint={err("resumeUrl") ?? "ອັບໂຫຼດໃສ່ Google Drive ຫຼື OneDrive ແລ້ວວາງລິ້ງທີ່ນີ້"}
            >
              <input
                name="resumeUrl"
                type="url"
                placeholder="https://..."
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="ແນະນຳຕົນເອງ (Cover Letter)">
              <textarea
                name="coverLetter"
                rows={4}
                placeholder="ເປັນຫຍັງທ່ານຈຶ່ງເໝາະສົມກັບຕຳແໜ່ງນີ້"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="ຮູ້ຂ່າວການຮັບສະໝັກຈາກໃສ">
            <input
              name="source"
              placeholder="ເຊັ່ນ: Facebook, ໝູ່ແນະນຳ"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Button type="submit" disabled={pending} className="w-full md:w-auto">
        {pending ? "ກຳລັງສົ່ງ..." : "ສົ່ງໃບສະໝັກ"}
      </Button>
    </form>
  );
}
