"use client";

import { useState, useTransition } from "react";
import { Badge, inputClass } from "@/components/ui";
import { reinstateEmployee, resignEmployee } from "../actions";

export type PendingWork = {
  assets: number;
  trips: number;
  leaves: number;
  ots: number;
  corrections: number;
  isApprover: boolean;
};

/**
 * ບັນທຶກການລາອອກ / ເລີກຈ້າງ.
 *
 * ແຍກອອກຈາກຟອມແກ້ໄຂທົ່ວໄປໂດຍເຈດຕະນາ — ເປັນການປ່ຽນທີ່ມີຜົນຫຼາຍບ່ອນ
 * (ປິດບັນຊີ login, ຕັດອອກຈາກລາຍຊື່ຄົນຂັບ/ເງິນເດືອນ) ຈຶ່ງຄວນມີການຢືນຢັນຂອງຕົນເອງ.
 */
export function ResignPanel({
  code,
  name,
  hrStatus,
  resignDate,
  pending,
  today,
}: {
  code: string;
  name: string;
  hrStatus: string | null;
  resignDate: string | null;
  pending: PendingWork;
  today: string;
}) {
  const gone = hrStatus === "RESIGNED" || hrStatus === "TERMINATED";
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const totalPending =
    pending.assets + pending.trips + pending.leaves + pending.ots + pending.corrections;

  function run(fn: (f: FormData) => Promise<{ ok: boolean; message?: string; error?: string }>, form: FormData) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await fn(form);
      if (res.ok) {
        setMsg(res.message ?? "ບັນທຶກແລ້ວ");
        setOpen(false);
      } else setErr(res.error ?? "ຜິດພາດ");
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">ສະຖານະການຈ້າງງານ</h2>
        {gone ? (
          <Badge tone="red">{hrStatus === "RESIGNED" ? "ລາອອກແລ້ວ" : "ຖືກໃຫ້ອອກ"}</Badge>
        ) : (
          <Badge tone="green">ຍັງເຮັດວຽກຢູ່</Badge>
        )}
        {resignDate && <span className="text-xs text-muted">ມີຜົນ {resignDate}</span>}
      </div>

      {err && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}
      {msg && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {gone ? (
        <form action={(f) => run(reinstateEmployee, f)} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="code" value={code} />
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-medium">ເຫດຜົນທີ່ຮັບກັບ</span>
            <input name="reason" placeholder="ເຊັ່ນ ກັບເຂົ້າເຮັດວຽກຄືນ" className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "ກຳລັງບັນທຶກ…" : "ຮັບກັບເຂົ້າເຮັດວຽກ"}
          </button>
        </form>
      ) : !open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          ບັນທຶກການລາອອກ / ເລີກຈ້າງ
        </button>
      ) : (
        <form action={(f) => run(resignEmployee, f)} className="space-y-3">
          <input type="hidden" name="code" value={code} />

          {totalPending > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{name} ຍັງມີວຽກຄ້າງ {totalPending} ລາຍການ</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {pending.assets > 0 && <li>ຊັບສິນທີ່ຍັງບໍ່ຄືນ {pending.assets} ລາຍການ</li>}
                {pending.trips > 0 && <li>Trip ທີ່ຍັງບໍ່ຈົບ {pending.trips} ລາຍການ</li>}
                {pending.leaves > 0 && <li>ໃບລາທີ່ລໍອະນຸມັດ {pending.leaves} ລາຍການ</li>}
                {pending.ots > 0 && <li>ໃບ OT ທີ່ລໍອະນຸມັດ {pending.ots} ລາຍການ</li>}
                {pending.corrections > 0 && <li>ຄຳຂໍແກ້ເວລາ {pending.corrections} ລາຍການ</li>}
              </ul>
              <p className="mt-1.5 text-xs">ບັນທຶກໄດ້ຢູ່ ແຕ່ຄວນຈັດການລາຍການເຫຼົ່ານີ້ກ່ອນ</p>
            </div>
          )}
          {pending.isApprover && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ຄົນນີ້ຖືກຕັ້ງເປັນ <strong>ຜູ້ອະນຸມັດລົດ</strong> — ຢ່າລືມຕັ້ງຄົນແທນທີ່ ຕັ້ງຄ່າຜູ້ອະນຸມັດລົດ
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ປະເພດ</span>
              <select name="status" defaultValue="RESIGNED" className={inputClass}>
                <option value="RESIGNED">ລາອອກເອງ</option>
                <option value="TERMINATED">ຖືກໃຫ້ອອກ / ໝົດສັນຍາ</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ວັນທີ່ມີຜົນ</span>
              <input type="date" name="effectiveDate" defaultValue={today} className={inputClass} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ເຫດຜົນ</span>
              <input name="reason" placeholder="ເຊັ່ນ ລາອອກໄປຮຽນຕໍ່" className={inputClass} required />
            </label>
          </div>

          <p className="text-xs text-muted">
            ບັນທຶກແລ້ວຈະ: ຕັ້ງສະຖານະເປັນອອກແລ້ວ · ປິດບັນຊີເຂົ້າລະບົບ ·
            ຕັດອອກຈາກລາຍຊື່ຄົນຂັບ/ຜູ້ຮັບເງິນເດືອນ · ບັນທຶກໄວ້ໃນປະຫວັດການປ່ຽນແປງ
          </p>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "ກຳລັງບັນທຶກ…" : "ຢືນຢັນ"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
            >
              ຍົກເລີກ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
