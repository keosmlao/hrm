import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inputClass } from "@/components/ui";
import { laoDateTime } from "@/lib/format";
import { refuelEventsBetween, vehicleTankLitres, type RefuelRow } from "@/lib/fuel-cache";
import { RefuelBadge } from "../refuel-badge";
import { reviewRefuelEvent } from "./actions";

export const dynamic = "force-dynamic";

const DAYS = 45;

type Vehicle = { id: string; plate: string; name: string };

/**
 * ✅ ຄິວກວດເຫດການນ້ຳມັນ — ໃຫ້ HR/ຜູ້ຈັດການ ຕັດສິນເປັນລາຍເຫດການ
 * ຈັດ 3 ຄິວ: ນ້ຳມັນຫຼຸດຂະນະຈອດ (ດ່ວນ) · ຄວາມໝັ້ນໃຈຕ່ຳ · ເຕີມແຕ່ຍັງບໍ່ພົບບິນ
 * ຄຳຕັດສິນຂຽນລົງ confirm_status ແລ້ວໃຫ້ຄະແນນຄືນ (ເບິ່ງ review/actions.ts)
 */
export default async function RefuelReviewPage() {
  await requireRole("ADMIN", "HR", "MANAGER");
  const now = new Date();
  const since = new Date(now.getTime() - DAYS * 86_400_000);

  const [events, vehicleRows, tanks] = await Promise.all([
    refuelEventsBetween(since, now),
    prisma.carVehicle.findMany({
      where: { gpsImei: { not: null } },
      select: { id: true, plateNo: true, name: true, gpsImei: true },
    }),
    vehicleTankLitres(),
  ]);

  const byImei = new Map<string, Vehicle>(
    vehicleRows
      .filter((v) => v.gpsImei?.trim())
      .map((v) => [v.gpsImei!.trim(), { id: v.id.toString(), plate: v.plateNo, name: v.name }]),
  );

  const pending = events.filter((e) => e.confirmStatus == null);
  const drops = pending.filter((e) => e.kind === "DROP");
  const lowConfidence = pending.filter((e) => e.kind === "REFUEL" && e.confidence === "CHECK");
  const noReceipt = pending.filter((e) => e.kind === "REFUEL" && e.confidence !== "CHECK" && !e.checks?.receipt);
  const decided = events.filter((e) => e.confirmStatus != null).slice(0, 20);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#3b1d10] to-[#7c3a12] px-6 py-6 text-white">
        <h1 className="text-2xl font-bold tracking-tight">✅ ກວດເຫດການນ້ຳມັນ</h1>
        <p className="mt-1 text-sm text-white/70">
          ຕັດສິນເປັນລາຍເຫດການ — ຄຳຕັດສິນຂອງທ່ານມີນ້ຳໜັກສູງກວ່າຄະແນນອັດຕະໂນມັດ ແລະ ຈະສະທ້ອນໃນລາຍງານທັນທີ
        </p>
        <p className="tabular mt-3 text-[11px] text-white/50">
          {DAYS} ວັນຫຼ້າສຸດ · ລໍກວດ {pending.length} ເຫດການ · ຕັດສິນແລ້ວ {events.length - pending.length}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/fleet/fuel/cost" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">💰 ຕົ້ນທຶນ / ກວດບິນ</Link>
          <Link href="/fleet/fuel" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">⛽ ລາຍງານນ້ຳມັນ</Link>
          <Link href="/fleet/fuel/stations" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">📍 ຈຸດເຕີມ</Link>
        </div>
      </section>

      <Queue
        title="🩸 ນ້ຳມັນຫຼຸດຂະນະຈອດ"
        hint="ລົດຈອດ ບໍ່ໄດ້ແລ່ນ ແຕ່ນ້ຳມັນຫາຍ — ອາດຖືກດູດ, ຮົ່ວ, ຫຼື ເຊັນເຊີກະໂດດ. ຄວນກວດກ່ອນອື່ນ"
        tone="rose"
        rows={drops}
        byImei={byImei}
        tanks={tanks}
      />
      <Queue
        title="🟡 ຄວາມໝັ້ນໃຈຕ່ຳ"
        hint="ຖັງຂຶ້ນໜ້ອຍ ຫຼື ຢູ່ນອກຈຸດເຕີມທີ່ຮູ້ຈັກ — ຢືນຢັນວ່າເຕີມແທ້ບໍ"
        tone="amber"
        rows={lowConfidence}
        byImei={byImei}
        tanks={tanks}
      />
      <Queue
        title="⛽ ເຕີມແຕ່ຍັງບໍ່ພົບບິນ"
        hint="ເຊັນເຊີເຫັນຖັງຂຶ້ນ ແຕ່ຍັງບໍ່ພົບໃບບິນໃນລະບົບ (ຫາໃນແອັບຂົນສົ່ງ ±1 ວັນ / ແອັບຂາຍ ±45 ນາທີ)"
        tone="slate"
        rows={noReceipt}
        byImei={byImei}
        tanks={tanks}
      />

      {decided.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold">ຕັດສິນແລ້ວ ({events.length - pending.length})</h2>
            <p className="text-[11px] text-muted">ຖ້າຕັດສິນຜິດ ກົດ “ຍົກເລີກຄຳຕັດສິນ” ເພື່ອສົ່ງກັບຄິວ</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5">ລົດ</th>
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5">ວັນເວລາ</th>
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5 text-right">ປ່ຽນແປງ</th>
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5 text-right">ໃນຖັງ</th>
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5">ຄຳຕັດສິນ</th>
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5">ໝາຍເຫດ</th>
                  <th className="border-b border-border bg-slate-50 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {decided.map((e, i) => {
                  const v = byImei.get(e.imei);
                  const tank = tanks.get(e.imei);
                  return (
                    <tr key={e.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                      <td className="border-b border-border px-4 py-2.5 font-semibold">
                        {v ? (
                          <Link href={`/fleet/vehicles/${v.id}`} className="hover:text-primary hover:underline">{v.plate}</Link>
                        ) : (
                          e.imei
                        )}
                      </td>
                      <td className="tabular whitespace-nowrap border-b border-border px-4 py-2.5">{laoDateTime(new Date(e.time))}</td>
                      <td className={`tabular whitespace-nowrap border-b border-border px-4 py-2.5 text-right font-bold ${e.kind === "DROP" ? "text-rose-700" : "text-emerald-700"}`}>
                        {e.kind === "DROP" ? "−" : "+"}{e.litre} ລ
                      </td>
                      <td className="tabular whitespace-nowrap border-b border-border px-4 py-2.5 text-right">
                        {tank
                          ? `${Math.round((e.beforePercent / 100) * tank)} → ${Math.round((e.afterPercent / 100) * tank)} ລ`
                          : `${e.beforePercent}% → ${e.afterPercent}%`}
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-4 py-2.5">
                        <span className={e.confirmStatus === "CONFIRMED" ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>
                          {e.confirmStatus === "CONFIRMED" ? "✅ ເຕີມແທ້" : "❌ ບໍ່ແມ່ນການເຕີມ"}
                        </span>
                        <span className="block text-[10px] text-muted">{e.confirmedBy ?? "—"}</span>
                      </td>
                      <td className="max-w-[260px] truncate border-b border-border px-4 py-2.5 text-muted" title={e.confirmNote ?? ""}>
                        {e.confirmNote ?? "—"}
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right">
                        <form action={reviewRefuelEvent}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="decision" value="CLEAR" />
                          <button className="text-[11px] text-primary hover:underline">ຍົກເລີກ</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Queue({
  title,
  hint,
  tone,
  rows,
  byImei,
  tanks,
}: {
  title: string;
  hint: string;
  tone: "rose" | "amber" | "slate";
  rows: RefuelRow[];
  byImei: Map<string, Vehicle>;
  tanks: Map<string, number>;
}) {
  const bar = { rose: "bg-rose-500", amber: "bg-amber-500", slate: "bg-slate-400" }[tone];
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className={`size-2 rounded-full ${bar}`} aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold">{title} ({rows.length})</h2>
          <p className="text-[11px] text-muted">{hint}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted">ບໍ່ມີລາຍການລໍກວດ</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="border-b border-border bg-slate-50 px-4 py-2.5">ລົດ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-2.5">ວັນເວລາ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-2.5 text-right">ປ່ຽນແປງ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-2.5 text-right">ໃນຖັງ ກ່ອນ → ຫຼັງ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-2.5 text-right">ຈອດ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-2.5">ສະຖານທີ່ / ຄວາມໝັ້ນໃຈ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-2.5">ຕັດສິນ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const v = byImei.get(e.imei);
                const tank = tanks.get(e.imei);
                const zebra = i % 2 === 1;
                return (
                  <tr key={e.id} className={zebra ? "bg-slate-50/50" : ""}>
                    <td className="border-b border-border px-4 py-2.5">
                      {v ? (
                        <Link href={`/fleet/vehicles/${v.id}`} className="font-bold text-slate-800 hover:text-primary hover:underline">
                          {v.plate}
                        </Link>
                      ) : (
                        <span className="font-bold text-slate-800">{e.imei}</span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-muted">{v?.name}</span>
                    </td>
                    <td className="tabular whitespace-nowrap border-b border-border px-4 py-2.5">{laoDateTime(new Date(e.time))}</td>
                    <td className={`tabular whitespace-nowrap border-b border-border px-4 py-2.5 text-right font-bold ${e.kind === "DROP" ? "text-rose-700" : "text-emerald-700"}`}>
                      {e.kind === "DROP" ? "−" : "+"}{e.litre} ລ
                    </td>
                    <td className="tabular whitespace-nowrap border-b border-border px-4 py-2.5 text-right">
                      {tank ? `${Math.round((e.beforePercent / 100) * tank)} → ${Math.round((e.afterPercent / 100) * tank)} ລ` : "—"}
                      <span className="block text-[10px] text-muted">
                        {e.beforePercent}% → {e.afterPercent}%{tank ? ` · ຖັງ ${Math.round(tank)} ລ` : ""}
                      </span>
                    </td>
                    <td className="tabular whitespace-nowrap border-b border-border px-4 py-2.5 text-right">{e.stopMinutes ?? "—"} ນທ</td>
                    <td className="border-b border-border px-4 py-2.5">
                      <span className="block max-w-[280px] truncate text-[11px] text-muted" title={e.address ?? ""}>
                        {e.address ?? "ບໍ່ຮູ້ສະຖານທີ່"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <RefuelBadge e={e} />
                        {e.lat != null && e.lng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline"
                          >
                            ແຜນທີ່ ↗
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="border-b border-border px-4 py-2.5">
                      <form action={reviewRefuelEvent} className="flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="id" value={e.id} />
                        <input name="note" placeholder="ໝາຍເຫດ" className={`${inputClass} w-32 text-xs`} />
                        <button
                          name="decision"
                          value="CONFIRMED"
                          className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                          title="ຢືນຢັນວ່າເປັນການເຕີມ/ເຫດການຈິງ"
                        >
                          ✅ ແທ້
                        </button>
                        <button
                          name="decision"
                          value="REJECTED"
                          className="rounded-md bg-rose-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-800"
                          title="ບໍ່ແມ່ນການເຕີມ (ເຊັນເຊີແກວ່ງ/ຜິດພາດ)"
                        >
                          ❌ ບໍ່ແມ່ນ
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
