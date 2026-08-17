"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { updateVehicle } from "./actions";

export type EditableVehicle = {
  id: string;
  plateNo: string;
  name: string;
  status: string | null;
  currentMileage: number | null;
  departmentCode: string | null;
  vehicleTypeId: string | null;
  branchCode: string | null;
};

/** ພະແນກພ້ອມຝ່າຍທີ່ສັງກັດ — ໃຊ້ກັ່ນຕອງ ຝ່າຍ → ພະແນກ */
export type DeptOption = { code: string; nameLo: string; divisionCode: string };
export type DivisionOption = { code: string; nameLo: string };
export type BranchOption = { code: string; name: string; address: string | null };

const STATUS_OPTIONS = [
  { value: "available", label: "ຫວ່າງ" },
  { value: "in_use", label: "ກຳລັງໃຊ້" },
  { value: "maintenance", label: "ສ້ອມແປງ" },
  { value: "retired", label: "ປົດລະວາງ" },
];

/**
 * ແກ້ຂໍ້ມູນລົດເປັນລາຍຄັນ.
 *
 * ເປັນ modal ລອຍ (fixed) ບໍ່ແມ່ນ panel ໃນ `<td>` — ຊ່ອງສຸດທ້າຍຂອງຕາຕະລາງແຄບ
 * ເກີນໄປ ຟອມຈະຖືກບີບຈົນອ່ານບໍ່ອອກ.
 */
export function VehicleEdit({
  vehicle,
  types,
  departments,
  divisions,
  branches,
}: {
  vehicle: EditableVehicle;
  types: { id: string; name: string }[];
  departments: DeptOption[];
  divisions: DivisionOption[];
  branches: BranchOption[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [division, setDivision] = useState(
    departments.find((d) => d.code === vehicle.departmentCode)?.divisionCode ?? "",
  );

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await updateVehicle(form);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-slate-50"
      >
        ແກ້ໄຂ
      </button>
    );
  }

  const deptChoices = division ? departments.filter((d) => d.divisionCode === division) : departments;

  return (
    <>
      <button
        onClick={close}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-slate-50"
      >
        ປິດ
      </button>

      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
        onClick={close}
      >
        <div
          className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 text-left shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">ແກ້ໄຂຂໍ້ມູນລົດ · {vehicle.plateNo}</h3>
            <button onClick={close} className="text-sm text-muted hover:underline">
              ປິດ
            </button>
          </div>

          <form action={submit} className="space-y-4">
            <input type="hidden" name="id" value={vehicle.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ປ້າຍທະບຽນ</span>
                <input name="plateNo" defaultValue={vehicle.plateNo} className={inputClass} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ຍີ່ຫໍ້ / ຊື່</span>
                <input name="name" defaultValue={vehicle.name} className={inputClass} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ປະເພດລົດ</span>
                <select
                  name="vehicleTypeId"
                  defaultValue={vehicle.vehicleTypeId ?? ""}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ໄມລ໌ປັດຈຸບັນ</span>
                <input
                  name="currentMileage"
                  type="number"
                  min="0"
                  defaultValue={vehicle.currentMileage ?? 0}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ຝ່າຍ</span>
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className={inputClass}
                >
                  <option value="">ທຸກຝ່າຍ</option>
                  {divisions.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.nameLo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ພະແນກທີ່ນຳໃຊ້</span>
                <select
                  name="departmentCode"
                  defaultValue={vehicle.departmentCode ?? ""}
                  key={division}
                  className={inputClass}
                >
                  <option value="">— ໃຊ້ຮ່ວມ (ບໍ່ສັງກັດພະແນກ) —</option>
                  {deptChoices.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} · {d.nameLo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ສະຖານະ</span>
                <select name="status" defaultValue={vehicle.status ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">ສາຂາທີ່ລົດປະຈຳຢູ່</span>
                <select name="branchCode" defaultValue={vehicle.branchCode ?? ""} className={inputClass}>
                  <option value="">— ຍັງບໍ່ໄດ້ລະບຸສາຂາ —</option>
                  {branches.map((branch) => (
                    <option key={branch.code} value={branch.code}>
                      {branch.code} · {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55] disabled:opacity-50"
              >
                {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
              >
                ຍົກເລີກ
              </button>
              <span className="ml-auto text-xs text-muted">ຄ່າພວກນີ້ຈະບໍ່ຖືກການຊິງຄ໌ຈາກ GPS ທັບ</span>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
