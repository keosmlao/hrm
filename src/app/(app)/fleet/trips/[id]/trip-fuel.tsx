import { Badge, Card, StatCard } from "@/components/ui";
import type { TripFuelReport } from "@/lib/fuel-cache";
import { RefuelBadge } from "../../fuel/refuel-badge";

/**
 * ⛽ ນ້ຳມັນ (GPS) ຂອງ Trip — ໃຊ້ໄປ / ໄລຍະ / ເຫດການເຕີມ (ສະເພາະລົດເຊັນເຊີ) ທຽບກັບບິນນ້ຳມັນ
 * ໜ້າຕາດຽວກັບຝັ່ງ SALE (/plan/[id]) — ຄົນຂັບ/ຝ່າຍຂາຍເຫັນຢູ່ SALE, HR/ຜູ້ຈັດການເຫັນຢູ່ນີ້
 */
export default function TripFuelCard({
  fuel,
  plate,
  fuelBills,
  billTotal,
}: {
  fuel: TripFuelReport;
  plate: string;
  fuelBills: number;
  billTotal: number;
}) {
  const sensor = fuel.method === "sensor";
  const mismatch =
    sensor && !fuel.note
      ? fuel.events.length > 0 && fuelBills === 0
        ? "GPS ເຫັນການເຕີມ ແຕ່ຍັງບໍ່ມີບິນນ້ຳມັນໃນຄ່າໃຊ້ຈ່າຍ"
        : fuelBills > 0 && fuel.events.filter((e) => e.kind === "REFUEL").length === 0
          ? "ມີບິນນ້ຳມັນ ແຕ່ເຊັນເຊີບໍ່ເຫັນລະດັບຖັງຂຶ້ນ (ເຕີມນ້ອຍກວ່າ ~6 L ຈະບໍ່ເຫັນ)"
          : null
      : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          ⛽ ນ້ຳມັນ (GPS) · {plate}{" "}
          {sensor ? <Badge tone="blue">ເຊັນເຊີຖັງ</Badge> : fuel.method === "rate" ? <Badge tone="violet">ອັດຕາ ກມ/ລິດ</Badge> : <Badge tone="amber">ບໍ່ມີຂໍ້ມູນ</Badge>}
        </h2>
        <p className="text-xs text-muted">{fmt(fuel.from)} → {fmt(fuel.to)}</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ໃຊ້ໄປ" value={fuel.usedLitre != null ? `${fuel.usedLitre.toFixed(1)} ລິດ` : "—"} />
        <StatCard label="ໄລຍະທາງ" value={fuel.distanceKm != null ? `${Math.round(fuel.distanceKm).toLocaleString()} ກມ` : "—"} />
        <StatCard label="ເຕີມ (GPS)" value={sensor ? `${fuel.events.length} ຄັ້ງ · ≈${fuel.refuelLitre} ລິດ` : "—"} tone={sensor && fuel.events.length > 0 ? "good" : undefined} />
        <StatCard label="ບິນນ້ຳມັນ" value={fuelBills ? `${fuelBills} ໃບ · ${Math.round(billTotal).toLocaleString()} ₭` : "ບໍ່ມີ"} tone={fuelBills ? "warn" : undefined} />
      </div>

      {sensor && fuel.startPercent != null && fuel.endPercent != null && (
        <p className="mt-3 text-xs text-muted">
          ລະດັບຖັງ {fuel.startPercent}% → {fuel.endPercent}%{fuel.tankLitre ? ` (ຖັງ ${fuel.tankLitre} ລິດ)` : ""}
        </p>
      )}
      {fuel.note && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">ℹ️ {fuel.note}</p>}
      {mismatch && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">⚠️ {mismatch}</p>}

      {sensor && fuel.events.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {fuel.events.map((e) => (
            <li key={e.time} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium">{e.kind === "DROP" ? "🩸" : "⛽"} {fmt(e.time)} · {e.beforePercent}% → {e.afterPercent}%</p>
                <p className="text-xs text-muted">🅿 ຈອດ {fmtHM(e.stopStart)}–{fmtHM(e.stopEnd)} ({e.stopMinutes} ນາທີ)</p>
                <p className="mt-0.5"><RefuelBadge e={e} /></p>
                <p className="truncate text-xs text-muted">
                  {e.address ?? (e.lat != null && e.lng != null ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : "")}
                  {e.lat != null && e.lng != null && (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">ແຜນທີ່</a>
                    </>
                  )}
                </p>
              </div>
              <span className={`shrink-0 font-semibold ${e.kind === "DROP" ? "text-rose-700" : e.confidence === "REJECTED" ? "text-slate-400 line-through" : "text-emerald-700"}`}>≈ {e.kind === "DROP" ? "−" : "+"}{e.litre} ລິດ</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">ຄວາມລະອຽດເຊັນເຊີ ≈ ±3–4 ລິດ · ຕົວເລກ &quot;ໃຊ້ໄປ&quot; ເປັນຂອງ Lao GPS (ບໍ່ໄດ້ບວກ % ເອງ)</p>
    </Card>
  );
}

function fmtHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Vientiane", hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { timeZone: "Asia/Vientiane", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
}
