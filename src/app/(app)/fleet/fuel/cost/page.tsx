import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, inputClass } from "@/components/ui";
import { ReportActions } from "@/components/report-actions";
import { kip } from "@/lib/format";
import { num } from "@/lib/fleet-gps";
import { FUEL_BILL_SOURCE_LABEL } from "@/lib/fuel-bills";
import { STATUS_LABEL, VARIANCE_LIMIT_PCT, VARIANCE_MIN_LITRE, fleetFuelCost } from "@/lib/fuel-cost";

export const dynamic = "force-dynamic";

const LAO_MONTHS = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

function laoToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

function monthRange(monthISO: string, todayISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = `${monthISO}-01`;
  const end = monthISO === todayISO.slice(0, 7)
    ? todayISO
    : `${monthISO}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  return `${LAO_MONTHS[month - 1]} ${year}`;
}

function Stat({ label, value, hint, tone = "slate" }: { label: string; value: string; hint: string; tone?: "slate" | "rose" | "emerald" }) {
  const color = { slate: "text-slate-800", rose: "text-rose-600", emerald: "text-emerald-600" }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`tabular mt-2 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
    </div>
  );
}

/**
 * 💰 ຕົ້ນທຶນຕໍ່ກິໂລແມັດ + ກວດບິນນ້ຳມັນທຽບເຊັນເຊີ
 * ຂໍ້ມູນ: GPS (cache) · ບິນ TMS/SALE · ເຫດການເຊັນເຊີ · ຄ່າສ້ອມແປງ TMS — ເບິ່ງ lib/fuel-cost.ts
 */
export default async function FuelCostPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const query = await searchParams;
  const today = laoToday();
  const currentMonth = today.slice(0, 7);
  const requested = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : currentMonth;
  const month = requested <= currentMonth ? requested : currentMonth;
  const range = monthRange(month, today);
  const printedAt = new Date().toLocaleString("en-GB", { timeZone: "Asia/Vientiane", hour12: false });

  const report = await fleetFuelCost(range.start, range.end);
  const all = report.rows;
  const rows = all
    .filter((r) => r.status !== "NO_DATA")
    .sort((a, b) => (b.kipPerKm ?? -1) - (a.kipPerKm ?? -1) || b.distanceKm - a.distanceKm);
  const quiet = all.filter((r) => r.status === "NO_DATA");

  const totalDistance = rows.reduce((s, r) => s + r.distanceKm, 0);
  const totalFuelCost = rows.reduce((s, r) => s + r.billAmount, 0);
  const totalMaint = rows.reduce((s, r) => s + r.maintAmount, 0);
  const totalBillLitre = rows.reduce((s, r) => s + r.billLitre, 0);
  const totalSensorLitre = rows.reduce((s, r) => s + r.refuelLitre, 0);
  const fleetKipPerKm = totalDistance >= 1 ? (totalFuelCost + totalMaint) / totalDistance : null;
  const needCheck = rows.filter((r) => r.status === "CHECK");
  const drops = rows.filter((r) => r.dropCount > 0);
  const otherCurrency = rows.some((r) => r.maintOtherCurrency);

  const csvHeaders = [
    "ລົດ", "ພະແນກ", "ແຫຼ່ງບິນ", "ກມ_GPS", "ບິນ_ຄັ້ງ", "ບິນ_ລິດ", "ຄ່ານ້ຳມັນ_ກີບ", "ຄ່າສ້ອມແປງ_ກີບ",
    "ກີບຕໍ່ກມ", "ກມຕໍ່ລິດ", "ເຊັນເຊີ_ຄັ້ງ", "ເຊັນເຊີ_ລິດ", "ຕ່າງ_%", "ນ້ຳມັນຫຼຸດ_ຄັ້ງ", "ນ້ຳມັນຫຼຸດ_ລິດ", "ສະຖານະ",
  ];
  const csvRows = rows.map((r) => [
    r.plate, r.department ?? "", FUEL_BILL_SOURCE_LABEL[r.source], r.distanceKm.toFixed(1),
    r.billCount, r.billLitre.toFixed(1), r.billAmount.toFixed(0), r.maintAmount.toFixed(0),
    r.kipPerKm != null ? r.kipPerKm.toFixed(0) : "", r.kmPerLitre != null ? r.kmPerLitre.toFixed(2) : "",
    r.refuelCount, r.refuelLitre.toFixed(1), r.variancePct != null ? r.variancePct.toFixed(1) : "",
    r.dropCount, r.dropLitre.toFixed(1), STATUS_LABEL[r.status].text,
  ]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#2a1035] to-[#5b2b57] text-white print:bg-white print:text-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">💰 ຕົ້ນທຶນນ້ຳມັນ ແລະ ການກວດບິນ · {monthLabel(month)}</h1>
            <p className="mt-1 text-sm text-white/70 print:text-slate-600">
              ຄ່ານ້ຳມັນ + ຄ່າສ້ອມແປງ ຕໍ່ກິໂລແມັດ ແລະ ບິນທີ່ຄົນບັນທຶກ ທຽບກັບການເຕີມທີ່ເຊັນເຊີຈັບໄດ້
            </p>
            <p className="tabular mt-3 text-[11px] text-white/50 print:text-slate-500">
              ຊ່ວງ {range.start} → {range.end} · ລົດ {rows.length} ຄັນ · ອອກລາຍງານ {printedAt}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <ReportActions filename={`fuel-cost-${month}`} headers={csvHeaders} rows={csvRows} />
            <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl bg-black/15 p-2 ring-1 ring-white/10 print:hidden">
              <label>
                <span className="sr-only">ເດືອນ</span>
                <input
                  type="month"
                  name="month"
                  max={currentMonth}
                  defaultValue={month}
                  className={`${inputClass} border-white/15 bg-white/10 text-white [color-scheme:dark] focus:border-fuchsia-300`}
                />
              </label>
              <button className="rounded-md bg-fuchsia-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-fuchsia-200">
                ສະແດງ
              </button>
            </form>
          </div>
        </div>
      </section>

      {(report.comparePartial || report.skippedBills > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {report.comparePartial && (
            <p>
              ⏳ ເຫດການເຊັນເຊີໃນ DB ມີແຕ່ {report.sensorSince ?? "—"} ເປັນຕົ້ນໄປ — ຄໍລຳ “ເຊັນເຊີເຫັນ” ແລະ “ຕ່າງ”
              ຈຶ່ງຄິດສະເພາະ {report.compareFrom} → {range.end} (ຄ່ານ້ຳມັນ/ກມ ຄິດເຕັມເດືອນ).
              ຢາກໄດ້ຍ້ອນຫຼັງກວ່ານີ້ ຕ້ອງລ້າງ watermark ໃນ `hrm_vehicle_fuel_sync` ແລ້ວແລ່ນ `npm run gps:sync-fuel -- --refuel-days=31`
            </p>
          )}
          {report.skippedBills > 0 && (
            <p className="mt-1">
              ⚠ ຂ້າມບິນ {report.skippedBills} ໃບ ທີ່ຄ່າຜິດປົກກະຕິ (ລິດ ຫຼື ລາຄາຕໍ່ລິດ ນອກຊ່ວງທີ່ເປັນໄປໄດ້) — ຄວນແກ້ຢູ່ແອັບຕົ້ນທາງ
            </p>
          )}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="ຄ່ານ້ຳມັນ (ບິນ)" value={kip(totalFuelCost)} hint={`${num(totalBillLitre, 0)} ລິດ ຈາກ ${rows.reduce((s, r) => s + r.billCount, 0)} ໃບ`} />
        <Stat label="ຄ່າສ້ອມແປງ" value={kip(totalMaint)} hint={otherCurrency ? "⚠ ມີບິນສະກຸນອື່ນ ບໍ່ໄດ້ນັບ" : `${rows.reduce((s, r) => s + r.maintCount, 0)} ລາຍການ`} />
        <Stat label="ໄລຍະທາງ (GPS)" value={`${num(totalDistance, 0)} ກມ`} hint={`ສະເລ່ຍ ${num(totalDistance / Math.max(1, rows.length), 0)} ກມ/ຄັນ`} />
        <Stat
          label="ຕົ້ນທຶນຕໍ່ກິໂລແມັດ"
          value={fleetKipPerKm != null ? `${kip(fleetKipPerKm)}/ກມ` : "—"}
          hint="ຄ່ານ້ຳມັນ + ຄ່າສ້ອມແປງ ÷ ກມ"
          tone="emerald"
        />
        <Stat
          label="ຄັນທີ່ຄວນກວດ"
          value={`${needCheck.length} ຄັນ`}
          hint={`ນ້ຳມັນຫຼຸດຂະນະຈອດ ${drops.length} ຄັນ · ຕ່າງຈາກຄ່າກາງ fleet ເກີນ ${VARIANCE_LIMIT_PCT} ຈຸດ`}
          tone={needCheck.length ? "rose" : "emerald"}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-bold">ຕົ້ນທຶນ ແລະ ການກວດ ຕໍ່ຄັນ</h2>
            <p className="mt-0.5 text-xs text-muted">
              ຮຽງຕາມຕົ້ນທຶນຕໍ່ກິໂລແມັດຫຼາຍຫານ້ອຍ · ບິນ {num(totalBillLitre, 0)} ລິດ ທຽບເຊັນເຊີ {num(totalSensorLitre, 0)} ລິດ
              {report.medianVariancePct != null && ` · ຄ່າກາງ fleet ${report.medianVariancePct > 0 ? "+" : ""}${num(report.medianVariancePct, 0)}%`}
            </p>
          </div>
          <span className="flex gap-4 print:hidden">
            <Link href="/fleet/fuel/review" className="text-sm text-primary hover:underline">✅ ກວດເຫດການນ້ຳມັນ</Link>
            <Link href="/fleet/fuel" className="text-sm text-primary hover:underline">← ລາຍງານນ້ຳມັນ</Link>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="sticky left-0 z-20 min-w-44 border-b border-r border-border bg-slate-50 px-4 py-3">ລົດ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3">ພະແນກ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ກມ (GPS)</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ບິນ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຄ່ານ້ຳມັນ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຄ່າສ້ອມແປງ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ກີບ/ກມ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ກມ/ລິດ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເຊັນເຊີເຫັນ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຕ່າງ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ນ້ຳມັນຫຼຸດ</th>
                <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={12} text="ບໍ່ມີຂໍ້ມູນໃນເດືອນນີ້" />}
              {rows.map((r, i) => (
                <tr key={r.vehicleId} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                  <td className={`sticky left-0 z-10 border-b border-r border-border px-4 py-3 ${i % 2 === 1 ? "bg-slate-50" : "bg-card"}`}>
                    <Link href={`/fleet/vehicles/${r.vehicleId}`} className="font-bold text-slate-800 hover:text-primary hover:underline">
                      {r.plate}
                    </Link>
                    <p className="mt-0.5 text-[10px] text-muted">{r.name}</p>
                  </td>
                  <td className="border-b border-border px-4 py-3 text-[11px] text-muted">{r.department ?? "—"}</td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">{num(r.distanceKm, 0)}</td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">
                    {r.billCount ? `${r.billCount} ໃບ` : "—"}
                    {r.billLitre > 0 && <span className="block text-[10px] text-muted">{num(r.billLitre, 0)} ລ</span>}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">{r.billAmount ? kip(r.billAmount) : "—"}</td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">
                    {r.maintAmount ? kip(r.maintAmount) : "—"}
                    {r.maintOtherCurrency && <span className="block text-[10px] text-amber-600">⚠ ມີສະກຸນອື່ນ</span>}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-right tabular font-bold">
                    {r.kipPerKm != null ? kip(r.kipPerKm) : "—"}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">{r.kmPerLitre != null ? num(r.kmPerLitre, 1) : "—"}</td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">
                    {r.refuelCount ? `${r.refuelCount} ຄັ້ງ` : "—"}
                    {r.refuelLitre > 0 && <span className="block text-[10px] text-muted">{num(r.refuelLitre, 0)} ລ</span>}
                  </td>
                  <td
                    className={`border-b border-border px-4 py-3 text-right tabular font-semibold ${
                      r.status === "CHECK" && r.dropCount === 0 ? "text-rose-600" : "text-muted"
                    }`}
                    title={r.variancePct != null
                      ? `ບິນ ${num(r.billLitreCompared, 0)} ລ ທຽບ ເຊັນເຊີ ${num(r.refuelLitre, 0)} ລ (${report.compareFrom} → ${range.end})` +
                        (r.varianceVsMedian != null ? ` · ຕ່າງຈາກຄ່າກາງ ${r.varianceVsMedian > 0 ? "+" : ""}${num(r.varianceVsMedian, 0)} ຈຸດ` : "")
                      : ""}
                  >
                    {r.variancePct != null ? `${r.variancePct > 0 ? "+" : ""}${num(r.variancePct, 0)}%` : "—"}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-right tabular">
                    {r.dropCount ? <span className="font-semibold text-rose-600">{r.dropCount} ຄັ້ງ · {num(r.dropLitre, 0)} ລ</span> : "—"}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-center">
                    <Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].text}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td className="sticky left-0 z-10 border-t border-r border-border bg-slate-100 px-4 py-3">ລວມ {rows.length} ຄັນ</td>
                  <td className="border-t border-border px-4 py-3" />
                  <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalDistance, 0)}</td>
                  <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalBillLitre, 0)} ລ</td>
                  <td className="border-t border-border px-4 py-3 text-right tabular">{kip(totalFuelCost)}</td>
                  <td className="border-t border-border px-4 py-3 text-right tabular">{kip(totalMaint)}</td>
                  <td className="border-t border-border px-4 py-3 text-right tabular">{fleetKipPerKm != null ? kip(fleetKipPerKm) : "—"}</td>
                  <td className="border-t border-border px-4 py-3 text-right tabular">
                    {totalBillLitre > 0 ? num(totalDistance / totalBillLitre, 1) : "—"}
                  </td>
                  <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalSensorLitre, 0)} ລ</td>
                  <td className="border-t border-border px-4 py-3" />
                  <td className="border-t border-border px-4 py-3" />
                  <td className="border-t border-border px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 text-xs">
          <h3 className="text-sm font-bold">ອ່ານສະຖານະແນວໃດ</h3>
          <dl className="mt-3 space-y-2">
            <div><dt className="inline font-semibold">ຄວນກວດ — </dt><dd className="inline text-muted">ນ້ຳມັນຫຼຸດຂະນະຈອດ (ອາດຖືກດູດ) ຫຼື ຄ່າ “ຕ່າງ” ຫ່າງຈາກ<b>ຄ່າກາງຂອງ fleet</b>ເກີນ {VARIANCE_LIMIT_PCT} ຈຸດ ແລະ ຫ່າງກັນຢ່າງໜ້ອຍ {VARIANCE_MIN_LITRE} ລິດ</dd></div>
            <div><dt className="inline font-semibold">ເປັນຫຍັງອີງຄ່າກາງ — </dt><dd className="inline text-muted">ບິນມັກສູງກວ່າລິດທີ່ເຊັນເຊີເຫັນທຸກຄັນເປັນລະບົບ (ເຕີມຫຼາຍຈຸດ, ເຊັນເຊີອ່ານຊ້າ) ຈຶ່ງວັດ “ຜິດຈາກໝູ່” ແທນ “ຜິດຈາກສູນ”</dd></div>
            <div><dt className="inline font-semibold">ເຕີມແຕ່ບໍ່ມີບິນ — </dt><dd className="inline text-muted">ເຊັນເຊີເຫັນຖັງຂຶ້ນ ແຕ່ບໍ່ມີໃບບິນໃນລະບົບ</dd></div>
            <div><dt className="inline font-semibold">ມີບິນແຕ່ຖັງບໍ່ຂຶ້ນ — </dt><dd className="inline text-muted">ມີບິນ ແຕ່ເຊັນເຊີບໍ່ເຫັນການເຕີມ (ບິນຜິດຄັນ, ເຕີມໃສ່ພາຊະນະ, ຫຼື ເຊັນເຊີຄ້າງ)</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-xs">
          <h3 className="text-sm font-bold">ຂໍ້ຄວນລະວັງຂອງຂໍ້ມູນ</h3>
          <ul className="mt-3 space-y-2 text-muted">
            <li>• ບິນຂອງລົດຂົນສົ່ງ/ສູນບໍລິການ ມາຈາກ{FUEL_BILL_SOURCE_LABEL.TMS} — ຈັບຄູ່ດ້ວຍເລກທະບຽນ; ໃບທີ່ບໍ່ໄດ້ໃສ່ປ້າຍ (ເຊັ່ນ &quot;0000&quot;) ຈະບໍ່ຖືກນັບ</li>
            <li>• ບິນລົດຝ່າຍຂາຍ ມາຈາກ{FUEL_BILL_SOURCE_LABEL.SALE} (ຄ່າໃຊ້ຈ່າຍ Trip type ນ້ຳມັນ)</li>
            <li>• ຄ່າລິດ &gt; 200 ໃນບິນ ຖືວ່າພິມຜິດ (ໃສ່ຈຳນວນເງິນລົງຊ່ອງລິດ) ຈຶ່ງບໍ່ນັບເຂົ້າຍອດ</li>
            <li>• ຄ່າສ້ອມແປງນັບສະເພາະສະກຸນ LAK · ເຫດການເຊັນເຊີບໍ່ນັບອັນທີ່ຄົນໝາຍວ່າ &quot;ບໍ່ແມ່ນການເຕີມ&quot;</li>
            {quiet.length > 0 && <li>• ບໍ່ສະແດງ {quiet.length} ຄັນ ທີ່ບໍ່ມີທັງໄລຍະທາງ, ບິນ ແລະ ເຫດການໃນເດືອນນີ້</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
