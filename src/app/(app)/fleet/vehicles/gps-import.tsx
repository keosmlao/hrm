"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import type { SyncPlan } from "@/lib/laogps-sync";
import { applyGpsVehicles, previewGpsVehicles } from "./actions";

/**
 * ປຸ່ມດຶງລາຍການລົດຈາກ GPS ເຂົ້າ `app_car_vehicles`.
 * ກວດເບິ່ງກ່ອນສະເໝີ — ບໍ່ຂຽນທັນທີທີ່ກົດ ເພາະນີ້ເປັນຕາຕະລາງຂອງລະບົບ ERP.
 */
export function GpsImport() {
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ inserted: number; updated: number; conflicts: number } | null>(null);
  const [pending, start] = useTransition();

  function preview() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await previewGpsVehicles();
      if (res.ok) setPlan(res.plan);
      else {
        setPlan(null);
        setError(res.error);
      }
    });
  }

  function apply() {
    if (!plan) return;
    setError(null);
    start(async () => {
      const res = await applyGpsVehicles(plan);
      if (res.ok) {
        setDone(res);
        setPlan(null);
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={preview}
          disabled={pending}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {pending && !plan ? "ກຳລັງດຶງ..." : "↻ ດຶງລາຍການລົດຈາກ GPS"}
        </button>
        {plan && (
          <span className="text-xs text-muted">
            LaoGPS {plan.gpsCount} ຄັນ · ໃນລະບົບ {plan.dbCount} ຄັນ · ຈັບຄູ່ໄດ້ {plan.matched} ຄັນ
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ບັນທຶກແລ້ວ — ເພີ່ມ {done.inserted} ຄັນ
          {done.updated ? ` · ແກ້ໄຂ ${done.updated} ຄັນ` : ""}
          {done.conflicts ? ` · ຂ້າມ ${done.conflicts} ຄັນ (IMEI ມີຢູ່ແລ້ວ)` : ""}
        </div>
      )}

      {plan && <PlanPanel plan={plan} pending={pending} onApply={apply} onCancel={() => setPlan(null)} />}
    </div>
  );
}

function PlanPanel({
  plan,
  pending,
  onApply,
  onCancel,
}: {
  plan: SyncPlan;
  pending: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const nothing = plan.insert.length === 0 && plan.update.length === 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {nothing ? (
        <p className="text-sm text-muted">✓ ລົດໃນ GPS ມີຢູ່ໃນລະບົບຄົບແລ້ວ — ບໍ່ມີຫຍັງຕ້ອງເພີ່ມ</p>
      ) : (
        <>
          <div>
            <p className="mb-2 font-semibold">ຈະເພີ່ມລົດໃໝ່ {plan.insert.length} ຄັນ</p>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#f7f5f7]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted">ປ້າຍທະບຽນ</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted">ຍີ່ຫໍ້</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted">ປະເພດ</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted">IMEI</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.insert.map((x) => (
                    <tr key={x.imei} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">
                        {x.plate}
                        {x.fallbackPlate && (
                          <span className="ml-2 text-xs font-normal text-amber-600">ປ້າຍສຳຮອງ</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{x.name}</td>
                      <td className="px-3 py-2 text-xs text-muted">{x.category ?? "-"}</td>
                      <td className="tabular px-3 py-2 text-xs text-muted">{x.imei}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              ປະເພດລົດແປງມາຈາກ category ຂອງ GPS ອັດຕະໂນມັດ · ສະຖານະ={plan.options.status} · ໄມລ໌=0 —
              ແກ້ຕາມຈິງຢູ່ລະບົບ ERP ພາຍຫຼັງໄດ້. “ປ້າຍສຳຮອງ” ໝາຍວ່າ GPS ບໍ່ໄດ້ຕັ້ງປ້າຍທະບຽນໄວ້.
              ຂໍ້ມູນອຸປະກອນ (SIM, ລຸ້ນ, ຖັງນ້ຳມັນ, ວັນໝົດອາຍຸ) ຈະຖືກຊິງຄ໌ໃສ່ທຸກຄັນ ບໍ່ສະເພາະຄັນໃໝ່.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              onClick={onApply}
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55] disabled:opacity-50"
            >
              {pending ? "ກຳລັງບັນທຶກ..." : `ບັນທຶກ ${plan.insert.length} ຄັນເຂົ້າລະບົບ`}
            </button>
            <button
              onClick={onCancel}
              disabled={pending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
            >
              ຍົກເລີກ
            </button>
          </div>
        </>
      )}

      {plan.skipped.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-1 text-sm font-semibold">ຂ້າມ {plan.skipped.length} ຄັນ</p>
          <ul className="space-y-1 text-xs text-muted">
            {plan.skipped.map((s, i) => (
              <li key={i}>
                {s.label} — {s.why}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.orphans.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
            ມີໃນລະບົບ ແຕ່ບໍ່ພົບໃນ GPS {plan.orphans.length} ຄັນ
            <Badge tone="gray">ບໍ່ລຶບ</Badge>
          </p>
          <ul className="space-y-1 text-xs text-muted">
            {plan.orphans.map((o) => (
              <li key={o.id}>
                {o.plate} — imei {o.imei}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
