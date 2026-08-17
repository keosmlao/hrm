"use client";

import { useState, useTransition } from "react";
import { Badge, inputClass } from "@/components/ui";
import { createVehicleType, updateVehicleType } from "./actions";

export type VehicleTypeRow = { id: string; name: string; isActive: boolean; count: number };

/**
 * ຈັດການປະເພດລົດ (app_car_vehicle_types) — ເພີ່ມໃໝ່ ແລະ ປ່ຽນຊື່/ເປີດ-ປິດ.
 * ປະເພດທີ່ຍັງມີລົດໃຊ້ຢູ່ ຈະປິດໄດ້ ແຕ່ບໍ່ຫາຍໄປຈາກລົດຄັນນັ້ນ.
 */
export function TypeManager({ types }: { types: VehicleTypeRow[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: (f: FormData) => Promise<{ ok: boolean; error?: string }>, form: FormData) {
    setError(null);
    start(async () => {
      const res = await fn(form);
      if (res.ok) setEditing(null);
      else setError(res.error ?? "ຜິດພາດ");
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50"
      >
        ⚙ ປະເພດລົດ ({types.length})
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">ປະເພດລົດ</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">
          ປິດ
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}

      <ul className="mb-4 divide-y divide-border rounded-md border border-border">
        {types.map((t) => (
          <li key={t.id} className="px-3 py-2">
            {editing === t.id ? (
              <form action={(f) => run(updateVehicleType, f)} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input name="name" defaultValue={t.name} className={`${inputClass} max-w-48`} required />
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" name="isActive" defaultChecked={t.isActive} />
                  ໃຊ້ງານ
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  ບັນທຶກ
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                >
                  ຍົກເລີກ
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.name}</span>
                {!t.isActive && <Badge tone="gray">ປິດໃຊ້ງານ</Badge>}
                <span className="text-xs text-muted">{t.count} ຄັນ</span>
                <button
                  onClick={() => setEditing(t.id)}
                  className="ml-auto text-xs font-semibold text-primary hover:underline"
                >
                  ແກ້ໄຂ
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form action={(f) => run(createVehicleType, f)} className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">ເພີ່ມປະເພດໃໝ່</span>
          <input name="name" placeholder="ເຊັ່ນ ລົດຫົວລາກ" className={`${inputClass} min-w-56`} required />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55] disabled:opacity-50"
        >
          {pending ? "ກຳລັງເພີ່ມ..." : "ເພີ່ມ"}
        </button>
      </form>
    </div>
  );
}
