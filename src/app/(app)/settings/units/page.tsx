import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { NewUnitForm } from "./unit-forms";
import { deleteUnit, updateUnit } from "./actions";

export default async function UnitSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ unitMessage?: string; unitError?: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const { unitMessage, unitError } = await searchParams;

  const [divisions, departments, units, staffPerUnit] = await Promise.all([
    prisma.division.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.unit.findMany({ orderBy: { code: "asc" } }),
    prisma.employee.groupBy({ by: ["unitCode"], _count: true }),
  ]);

  const staffCount = new Map(staffPerUnit.map((s) => [s.unitCode ?? "", s._count]));
  const divisionName = new Map(divisions.map((d) => [d.code, d.nameLo]));
  const unitsByDept = new Map<string, typeof units>();
  for (const unit of units) {
    if (!unitsByDept.has(unit.departmentCode)) unitsByDept.set(unit.departmentCode, []);
    unitsByDept.get(unit.departmentCode)!.push(unit);
  }

  return (
    <>
      <PageHeader
        title="ກຳນົດໜ່ວຍງານ"
        subtitle="ເພີ່ມ ແລະ ແກ້ໄຂໜ່ວຍງານໃນແຕ່ລະພະແນກ — ໃຊ້ຢູ່ຟອມພະນັກງານ, ຜັງອົງກອນ ແລະ ການອະນຸມັດຕາມສາຍງານ"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມໜ່ວຍງານ</h2>
        <NewUnitForm
          divisions={divisions.map((d) => ({ code: d.code, name: d.nameLo }))}
          departments={departments.map((d) => ({
            code: d.code,
            name: d.nameLo,
            divisionCode: d.divisionCode,
          }))}
          unitCodes={units.map((u) => u.code)}
        />
      </Card>

      {(unitMessage || unitError) && (
        <p
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            unitError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {unitError ?? unitMessage}
        </p>
      )}

      <h2 className="mb-3 font-semibold">
        ໜ່ວຍງານທັງໝົດ ({units.length}) · {departments.length} ພະແນກ
      </h2>
      <Table>
        <thead>
          <tr>
            <Th className="w-28">ລະຫັດ</Th>
            <Th>ຊື່ໜ່ວຍງານ (ລາວ)</Th>
            <Th>ຊື່ (ອັງກິດ)</Th>
            <Th className="w-24">ພະນັກງານ</Th>
            <Th className="w-20">ເປີດໃຊ້</Th>
            <Th className="w-32"></Th>
          </tr>
        </thead>
        <tbody>
          {departments.length === 0 && <EmptyRow colSpan={6} />}
          {departments.map((department) => {
            const list = unitsByDept.get(department.code) ?? [];
            return (
              <Fragment key={department.code}>
                <tr className="bg-[#faf8fa]">
                  <Td colSpan={6} className="font-medium">
                    <span className="text-muted">
                      {divisionName.get(department.divisionCode) ?? department.divisionCode} ›{" "}
                    </span>
                    {department.code} — {department.nameLo}
                    <span className="ml-2 text-xs text-muted">({list.length} ໜ່ວຍງານ)</span>
                  </Td>
                </tr>
                {list.length === 0 && (
                  <tr>
                    <Td colSpan={6} className="text-sm text-muted">
                      ຍັງບໍ່ມີໜ່ວຍງານໃນພະແນກນີ້
                    </Td>
                  </tr>
                )}
                {list.map((unit) => {
                  const staff = staffCount.get(unit.code) ?? 0;
                  // ຟອມຢູ່ນອກຊ່ອງ ແລ້ວໃຫ້ຊ່ອງຕ່າງໆອ້າງດ້ວຍ form="..." — ຖັນຈຶ່ງຕົງກັບຫົວຕາຕະລາງ
                  const formId = `unit-${unit.code}`;
                  return (
                    <tr key={unit.code}>
                      <Td className="font-medium">
                        {unit.code}
                        <form id={formId} action={updateUnit.bind(null, unit.code)} />
                      </Td>
                      <Td>
                        <input
                          form={formId}
                          name="nameLo"
                          required
                          maxLength={200}
                          defaultValue={unit.nameLo}
                          className={inputClass}
                        />
                      </Td>
                      <Td>
                        <input
                          form={formId}
                          name="nameEn"
                          maxLength={200}
                          defaultValue={unit.nameEn ?? ""}
                          className={inputClass}
                        />
                      </Td>
                      <Td className="text-sm text-muted">{staff} ຄົນ</Td>
                      <Td className="text-center">
                        <input
                          form={formId}
                          name="isActive"
                          type="checkbox"
                          defaultChecked={unit.isActive !== false}
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <button form={formId} className="text-xs font-medium text-primary hover:underline">
                            ບັນທຶກ
                          </button>
                          {staff === 0 && (
                            <button
                              form={formId}
                              formAction={deleteUnit.bind(null, unit.code)}
                              formNoValidate
                              className="text-xs text-rose-600 hover:underline"
                            >
                              ລຶບ
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

export const dynamic = "force-dynamic";
