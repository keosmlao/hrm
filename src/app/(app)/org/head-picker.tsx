"use client";

import { useTransition } from "react";
import { setOrgHead } from "./actions";
import { Combobox } from "@/components/combobox";
import type { OrgScope } from "@/generated/prisma/client";

type Emp = { code: string; name: string };

/** ເລືອກ/ປ່ຽນ/ລຶບ ຫົວໜ້າຂອງໜ່ວຍ — ບັນທຶກທັນທີເມື່ອປ່ຽນ */
export function HeadPicker({
  scope,
  code,
  currentCode,
  employees,
}: {
  scope: OrgScope;
  code: string;
  currentCode: string | null;
  employees: Emp[];
}) {
  const [pending, start] = useTransition();

  return (
    <Combobox
      defaultValue={currentCode ?? ""}
      disabled={pending}
      onChange={(val) => start(() => setOrgHead(scope, code, val))}
      placeholder="— ບໍ່ມີຫົວໜ້າ —"
      className="w-56"
      options={[
        { value: "", label: "— ບໍ່ມີຫົວໜ້າ —" },
        ...employees.map((emp) => ({ value: emp.code, label: `${emp.code} · ${emp.name}` })),
      ]}
    />
  );
}
