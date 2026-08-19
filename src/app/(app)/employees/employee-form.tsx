"use client";

import { useActionState, useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { GENDER_LABEL, HR_STATUS_LABEL, MARITAL_LABEL } from "@/lib/labels";
import { toInputDate } from "@/lib/format";
import type { FormState } from "./actions";

export type Options = {
  divisions: { code: string; name: string }[];
  departments: { code: string; name: string; divisionCode: string }[];
  units: { code: string; name: string; departmentCode: string; isActive?: boolean }[];
  positions: { code: string; name: string }[];
  employees: { code: string; name: string }[];
};

export type EmployeeValues = {
  code?: string;
  titleLo?: string | null;
  fullnameLo?: string;
  fullnameEn?: string | null;
  nickname?: string | null;
  mobile?: string | null;
  hireDate?: Date | string | null;
  divisionCode?: string | null;
  departmentCode?: string | null;
  unitCode?: string | null;
  positionCode?: string | null;

  hrStatus?: string;
  gender?: string | null;
  dob?: Date | string | null;
  nationalId?: string | null;
  maritalStatus?: string | null;
  email?: string | null;
  address?: string | null;
  probationEndDate?: Date | string | null;
  managerCode?: string | null;
  baseSalary?: number | string;
  positionAllowance?: number | string;
  bankName?: string | null;
  bankAccountNo?: string | null;
  socialSecurityNo?: string | null;
};

export function EmployeeForm({
  action,
  options,
  values = {},
  isNew = false,
  submitLabel = "ບັນທຶກ",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  options: Options;
  values?: EmployeeValues;
  isNew?: boolean;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const err = (f: string) => state.fieldErrors?.[f];

  // ໜ່ວຍງານກັ່ນຕາມພະແນກທີ່ເລືອກ — ໜ່ວຍທີ່ປິດໃຊ້ງານແລ້ວເຊື່ອງໄວ້ ເວັ້ນແຕ່ຄົນນີ້ຢູ່ໜ່ວຍນັ້ນຢູ່
  const [deptCode, setDeptCode] = useState(values.departmentCode ?? "");
  const units = options.units.filter(
    (u) =>
      u.departmentCode === deptCode &&
      (u.isActive !== false || u.code === values.unitCode),
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">ຂໍ້ມູນສ່ວນຕົວ</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="ລະຫັດພະນັກງານ" required hint={err("code")}>
            <input
              name="code"
              defaultValue={values.code ?? ""}
              readOnly={!isNew}
              className={`${inputClass} ${!isNew ? "bg-slate-50 text-muted" : ""}`}
            />
          </Field>
          <Field label="ຄຳນຳໜ້າ">
            <input name="titleLo" placeholder="ທ້າວ / ນາງ" defaultValue={values.titleLo ?? ""} className={inputClass} />
          </Field>
          <Field label="ຊື່ ແລະ ນາມສະກຸນ (ລາວ)" required hint={err("fullnameLo")}>
            <input name="fullnameLo" defaultValue={values.fullnameLo ?? ""} className={inputClass} />
          </Field>
          <Field label="ຊື່ (ອັງກິດ)">
            <input name="fullnameEn" defaultValue={values.fullnameEn ?? ""} className={inputClass} />
          </Field>
          <Field label="ຊື່ຫຼິ້ນ">
            <input name="nickname" defaultValue={values.nickname ?? ""} className={inputClass} />
          </Field>
          <Field label="ເບີໂທ">
            <input name="mobile" defaultValue={values.mobile ?? ""} className={inputClass} />
          </Field>
          <Field label="ເພດ">
            <Combobox
              name="gender"
              defaultValue={values.gender ?? ""}
              options={[
                { value: "", label: "— ເລືອກ —" },
                ...Object.entries(GENDER_LABEL).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />
          </Field>
          <Field label="ວັນເກີດ">
            <input type="date" name="dob" defaultValue={toInputDate(values.dob)} className={inputClass} />
          </Field>
          <Field label="ເລກບັດປະຈຳຕົວ">
            <input name="nationalId" defaultValue={values.nationalId ?? ""} className={inputClass} />
          </Field>
          <Field label="ສະຖານະການແຕ່ງງານ">
            <Combobox
              name="maritalStatus"
              defaultValue={values.maritalStatus ?? ""}
              options={[
                { value: "", label: "— ເລືອກ —" },
                ...Object.entries(MARITAL_LABEL).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />
          </Field>
          <Field label="ອີເມວ">
            <input name="email" type="email" defaultValue={values.email ?? ""} className={inputClass} />
          </Field>
          <Field label="ທີ່ຢູ່">
            <input name="address" defaultValue={values.address ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">ຂໍ້ມູນການເຮັດວຽກ</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="ຝ່າຍ">
            <Combobox
              name="divisionCode"
              defaultValue={values.divisionCode ?? ""}
              options={[
                { value: "", label: "— ເລືອກ —" },
                ...options.divisions.map((d) => ({ value: d.code, label: d.name })),
              ]}
            />
          </Field>
          <Field label="ພະແນກ" required hint={err("departmentCode")}>
            <Combobox
              name="departmentCode"
              value={deptCode}
              onChange={setDeptCode}
              placeholder="— ເລືອກ —"
              options={[
                { value: "", label: "— ເລືອກ —" },
                ...options.departments.map((d) => ({ value: d.code, label: d.name })),
              ]}
            />
          </Field>
          <Field label="ໜ່ວຍງານ">
            <Combobox
              key={deptCode}
              name="unitCode"
              defaultValue={deptCode === (values.departmentCode ?? "") ? (values.unitCode ?? "") : ""}
              placeholder="— ບໍ່ລະບຸ —"
              options={[
                { value: "", label: "— ບໍ່ລະບຸ —" },
                ...units.map((u) => ({ value: u.code, label: u.name })),
              ]}
            />
          </Field>
          <Field label="ຕຳແໜ່ງ" required hint={err("positionCode")}>
            <Combobox
              name="positionCode"
              defaultValue={values.positionCode ?? ""}
              options={[
                { value: "", label: "— ເລືອກ —" },
                ...options.positions.map((p) => ({ value: p.code, label: p.name })),
              ]}
            />
          </Field>
          <Field label="ຫົວໜ້າໂດຍກົງ">
            <Combobox
              name="managerCode"
              defaultValue={values.managerCode ?? ""}
              placeholder="— ບໍ່ມີ —"
              options={[
                { value: "", label: "— ບໍ່ມີ —" },
                ...options.employees
                  .filter((e) => e.code !== values.code)
                  .map((e) => ({ value: e.code, label: e.name })),
              ]}
            />
          </Field>
          <Field label="ສະຖານະ" required>
            <Combobox
              name="hrStatus"
              defaultValue={values.hrStatus ?? "ACTIVE"}
              options={Object.entries(HR_STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Field>
          <Field label="ວັນເລີ່ມວຽກ" required hint={err("hireDate")}>
            <input type="date" name="hireDate" defaultValue={toInputDate(values.hireDate)} className={inputClass} />
          </Field>
          <Field label="ວັນຄົບທົດລອງງານ">
            <input type="date" name="probationEndDate" defaultValue={toInputDate(values.probationEndDate)} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">ເງິນເດືອນ ແລະ ທະນາຄານ</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="ເງິນເດືອນພື້ນຖານ (ກີບ)" required>
            <input type="number" name="baseSalary" min={0} step={1000}
              defaultValue={String(values.baseSalary ?? 0)} className={inputClass} />
          </Field>
          <Field label="ຄ່າຕຳແໜ່ງ (ກີບ)" required>
            <input type="number" name="positionAllowance" min={0} step={1000}
              defaultValue={String(values.positionAllowance ?? 0)} className={inputClass} />
          </Field>
          <Field label="ເລກປະກັນສັງຄົມ">
            <input name="socialSecurityNo" defaultValue={values.socialSecurityNo ?? ""} className={inputClass} />
          </Field>
          <Field label="ທະນາຄານ">
            <input name="bankName" defaultValue={values.bankName ?? ""} className={inputClass} />
          </Field>
          <Field label="ເລກບັນຊີ">
            <input name="bankAccountNo" defaultValue={values.bankAccountNo ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "ກຳລັງບັນທຶກ..." : submitLabel}
      </Button>
    </form>
  );
}
