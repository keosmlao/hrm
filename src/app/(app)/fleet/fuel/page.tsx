import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, inputClass } from "@/components/ui";
import { ReportActions } from "@/components/report-actions";
import {
  fuelLitreForDisplay,
  fuelReasonLabel,
  laoGpsConfigured,
  laoGpsErrorMessage,
  listFuel,
  type LaoGpsFuel,
  type LaoGpsFuelTotals,
} from "@/lib/laogps";
import { gpsVehicleOptions, num, resolveRange } from "@/lib/fleet-gps";
import {
  aggregateFuelDaily,
  fuelCacheUpdatedAt,
  fuelDailyRows,
  fuelSyncStates,
  refuelEventsBetween,
  type RefuelRow,
} from "@/lib/fuel-cache";
import { NORM_SOURCE_LABEL, SANE_MAX, SANE_MIN, correctFuel, vehicleFuelNorms } from "@/lib/fuel-quality";
import { GpsNotConfigured, GpsNotice } from "../gps-filter";

export const dynamic = "force-dynamic";

/**
 * ອ່ານຈາກ cache ໃນ DB (hrm_vehicle_fuel_daily — cron `npm run gps:sync-fuel` ທຸກຊົ່ວໂມງ) ຈຶ່ງເປີດໄດ້ 31 ວັນ.
 * ຖ້າ cache ຍັງບໍ່ມີຂໍ້ມູນຊ່ວງນັ້ນ ຈຶ່ງເອີ້ນ Lao GPS ສົດ (ຊ້າ — 7 ວັນ ≈ 90 ວິ) ສະເພາະ ≤ 7 ວັນ
 */
const MAX_DAYS = 31;
const LIVE_MAX_DAYS = 7;

/** GPS ບາງຄັນສົ່ງ placeholder ແທນທະບຽນ/ຊື່ລົດ. */
function usefulVehicleLabel(value: string | null | undefined) {
  const label = value?.trim();
  if (!label) return null;
  if (["ไม่ระบุ", "ບໍ່ລະບຸ", "unspecified", "unknown", "n/a", "-"].includes(label.toLowerCase())) {
    return null;
  }
  return label;
}

function Stat({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const color = {
    slate: "text-slate-800",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`tabular mt-2 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function fmtLao(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleString("en-GB", { timeZone: "Asia/Vientiane", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(",", "");
}

export default async function FleetFuelPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const { from, to, note } = resolveRange(q.from, q.to, MAX_DAYS);
  const printedAt = new Date().toLocaleString("en-GB", { timeZone: "Asia/Vientiane", hour12: false });

  if (!laoGpsConfigured()) {
    return (
      <>
        <h1 className="mb-5 text-2xl font-semibold">ລາຍງານນ້ຳມັນ</h1>
        <GpsNotConfigured />
      </>
    );
  }

  let rows: LaoGpsFuel[] | null = null;
  let totals: LaoGpsFuelTotals | undefined;
  let error: string | null = null;
  let source: "cache" | "live" = "cache";
  const cached = aggregateFuelDaily(await fuelDailyRows(from, to));
  const rangeDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (cached.length > 0) {
    rows = cached;
    const withFuel = rows.filter((r) => fuelLitreForDisplay(r) != null);
    totals = {
      fuel_used_litre: withFuel.length ? withFuel.reduce((s, r) => s + (fuelLitreForDisplay(r) ?? 0), 0) : null,
      distance_km: rows.reduce((s, r) => s + r.distance_km, 0),
      vehicles_with_fuel: withFuel.length,
      vehicles_without_fuel: rows.length - withFuel.length,
    };
  } else if (rangeDays <= LIVE_MAX_DAYS) {
    source = "live";
    try {
      const res = await listFuel({ from, to });
      rows = res.data;
      totals = res.meta.totals;
    } catch (e) {
      error = laoGpsErrorMessage(e);
    }
  } else {
    error = "ຍັງບໍ່ມີຂໍ້ມູນ cache ໃນຊ່ວງນີ້ — ໃຫ້ແລ່ນ `npm run gps:sync-fuel -- --days=31` ຢູ່ server ກ່ອນ";
  }

  const [cacheAt, syncStates, hrmVehicles, vehicleDepts, departments, normResult] = await Promise.all([
    fuelCacheUpdatedAt(),
    fuelSyncStates(),
    gpsVehicleOptions(),
    prisma.carVehicle.findMany({ where: { gpsImei: { not: null } }, select: { gpsImei: true, departmentCode: true } }),
    prisma.department.findMany({ select: { code: true, nameLo: true } }),
    vehicleFuelNorms(90),
  ]);
  const { norms, fleetKmPerLitre } = normResult;

  const hrmByImei = new Map(hrmVehicles.map((vehicle) => [vehicle.imei.trim(), vehicle]));
  const hrmImei = new Set(hrmByImei.keys());
  const deptName = new Map(departments.map((d) => [d.code, d.nameLo]));
  const deptByImei = new Map(
    vehicleDepts
      .filter((v) => v.gpsImei?.trim())
      .map((v) => [v.gpsImei!.trim(), (v.departmentCode && deptName.get(v.departmentCode)) || null]),
  );

  const multiDay = from !== to;

  // ⛽ ເຫດການເຕີມ (ຈາກ DB — cron ວິເຄາະໄວ້ແລ້ວ); ວັນທີ່ເລືອກເປັນເວລາລາວ (+07:00)
  const refuelList: RefuelRow[] = rows
    ? await refuelEventsBetween(new Date(`${from}T00:00:00+07:00`), new Date(`${to}T23:59:59+07:00`))
    : [];
  const refuels = new Map<string, { events: RefuelRow[]; litre: number; note: string | null }>();
  for (const e of refuelList) {
    const cur = refuels.get(e.imei) ?? { events: [], litre: 0, note: null };
    cur.events.push(e);
    if (e.kind === "REFUEL" && e.confidence !== "REJECTED") cur.litre += e.litre;
    refuels.set(e.imei, cur);
  }
  for (const [imei, st] of syncStates) {
    if (!st.note) continue;
    const cur = refuels.get(imei) ?? { events: [], litre: 0, note: null };
    cur.note = st.note;
    refuels.set(imei, cur);
  }
  const plateByImei = new Map((rows ?? []).map((r) => [r.imei.trim(), usefulVehicleLabel(r.plate)]));
  const refuelRows = [...refuels.entries()]
    .filter(([, rep]) => rep.events.length > 0 || rep.note)
    .map(([imei, rep]) => ({
      imei,
      rep,
      label:
        usefulVehicleLabel(hrmByImei.get(imei)?.plateNo) ??
        usefulVehicleLabel(hrmByImei.get(imei)?.name) ??
        plateByImei.get(imei) ??
        imei,
      vehicleId: hrmByImei.get(imei)?.id ?? null,
    }))
    .sort((a, b) => b.rep.litre - a.rep.litre);

  // ຈັດແຖວຕາຕະລາງ + ແກ້ຄ່າທີ່ Lao GPS ຄິດເພື້ອນ (ເບິ່ງ lib/fuel-quality.ts)
  const table = [...(rows ?? [])]
    .map((r) => {
      const imei = r.imei.trim();
      const fixed = correctFuel(r.distance_km, fuelLitreForDisplay(r), norms.get(imei));
      const kmPerL = fixed.litre && fixed.litre > 0 ? r.distance_km / fixed.litre : null;
      const hrm = hrmByImei.get(imei);
      return {
        imei,
        vehicleId: hrm?.id ?? null,
        plate: usefulVehicleLabel(hrm?.plateNo) ?? usefulVehicleLabel(r.plate) ?? imei,
        name: usefulVehicleLabel(hrm?.name) ?? usefulVehicleLabel(r.name) ?? "",
        department: deptByImei.get(imei) ?? null,
        inHrm: hrmImei.has(imei),
        litre: fixed.litre,
        estimated: fixed.estimated,
        reported: fixed.reported,
        norm: fixed.norm,
        distance: r.distance_km,
        driveHours: r.drive_hours,
        kmPerL,
        method: r.fuel_method,
        reason: r.fuel_reason,
        clamped: r.clamped,
        partial: r.partial_data,
        rep: refuels.get(imei),
      };
    })
    .sort((a, b) => (b.litre ?? -1) - (a.litre ?? -1));

  const measured = table.filter((r) => !r.estimated && r.litre != null && r.litre > 0);
  const odd = table.filter((r) => r.estimated);
  const totalDistance = totals?.distance_km ?? 0;
  // ຍອດລິດ = ຄ່າທີ່ແກ້ແລ້ວ (ບໍ່ແມ່ນຍອດດິບຂອງ Lao GPS)
  const totalLitre = table.some((r) => r.litre != null) ? table.reduce((s, r) => s + (r.litre ?? 0), 0) : null;
  const rawLitre = totals?.fuel_used_litre ?? null;
  const saneKm = measured.reduce((s, r) => s + r.distance, 0);
  const saneLitre = measured.reduce((s, r) => s + (r.litre ?? 0), 0);
  const refuelEventCount = refuelList.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED").length;
  const dropCount = refuelList.filter((e) => e.kind === "DROP").length;

  const csvHeaders = ["ລົດ", "ຍີ່ຫໍ້", "ພະແນກ", "ນ້ຳມັນ_ລິດ", "ໄລຍະທາງ_ກມ", "ກມຕໍ່ລິດ", "ເວລາແລ່ນ_ຊມ", "ເຕີມ_ຄັ້ງ", "ເຕີມ_ລິດ", "ວິທີວັດ"];
  const csvRows = table.map((r) => [
    r.plate,
    r.name,
    r.department ?? "",
    r.litre != null ? r.litre.toFixed(2) : "",
    r.distance.toFixed(1),
    r.kmPerL != null ? r.kmPerL.toFixed(2) : "",
    r.driveHours.toFixed(1),
    r.rep?.events.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED").length ?? 0,
    r.rep ? Math.round(r.rep.litre) : 0,
    r.method === "sensor" ? "ເຊັນເຊີຖັງ" : r.method === "rate" ? "ອັດຕາ ກມ/ລິດ" : "ວັດບໍ່ໄດ້",
  ]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#0b2f3a] to-[#0f5563] text-white print:bg-white print:text-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">⛽ ລາຍງານນ້ຳມັນ</h1>
            <p className="mt-1 text-sm text-white/70 print:text-slate-600">
              ຍອດການໃຊ້ນ້ຳມັນທີ່ວັດ/ຄຳນວນໂດຍແພລດຟອມ GPS · ບໍ່ແມ່ນຄ່າດິບຈາກເຊັນເຊີ
            </p>
            <p className="tabular mt-3 text-[11px] text-white/50 print:text-slate-500">
              ຊ່ວງ {from} → {to} ({rangeDays} ມື້, ສູງສຸດ {MAX_DAYS} ວັນ) ·{" "}
              {source === "cache"
                ? `cache ອັບເດດ ${cacheAt ? cacheAt.toLocaleString("en-GB", { timeZone: "Asia/Vientiane", hour12: false }) : "—"} (sync ທຸກຊົ່ວໂມງ)`
                : "ດຶງສົດຈາກ Lao GPS (cache ຍັງບໍ່ມີຊ່ວງນີ້)"}{" "}
              · ອອກລາຍງານ {printedAt}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs print:hidden">
              <Link href="/fleet/fuel/cost" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">💰 ຕົ້ນທຶນ / ກວດບິນ</Link>
              <Link href="/fleet/fuel/review" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">✅ ກວດເຫດການ</Link>
              <Link href="/fleet/fuel/stations" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">📍 ຈຸດເຕີມ</Link>
              <Link href="/fleet/fuel-norm" className="rounded-md bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/20">📏 ມາດຕະຖານກິນນ້ຳມັນ</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {rows && <ReportActions filename={`fuel-${from}_${to}`} headers={csvHeaders} rows={csvRows} />}
            <form action="/fleet/fuel" method="get" className="flex flex-wrap items-end gap-2 rounded-xl bg-black/15 p-2 ring-1 ring-white/10 print:hidden">
              <label className="text-[11px] text-white/60">
                ແຕ່ວັນທີ
                <input type="date" name="from" defaultValue={from} className={`${inputClass} mt-1 border-white/15 bg-white/10 text-white [color-scheme:dark] focus:border-teal-300`} />
              </label>
              <label className="text-[11px] text-white/60">
                ຫາວັນທີ
                <input type="date" name="to" defaultValue={to} className={`${inputClass} mt-1 border-white/15 bg-white/10 text-white [color-scheme:dark] focus:border-teal-300`} />
              </label>
              <button className="rounded-md bg-teal-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-200">ສະແດງ</button>
            </form>
          </div>
        </div>
      </section>

      {note && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{note}</p>
      )}

      {error && <GpsNotice title="ດຶງລາຍງານນ້ຳມັນບໍ່ໄດ້" detail={error} />}

      {rows && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="ນ້ຳມັນລວມ"
              value={totalLitre != null ? `${num(totalLitre, 1)} ລ` : "—"}
              hint={
                odd.length > 0 && rawLitre != null
                  ? `ແກ້ ${odd.length} ຄັນແລ້ວ · ຄ່າດິບ GPS ${num(rawLitre, 0)} ລ`
                  : `${totals?.vehicles_with_fuel ?? 0} ຄັນວັດໄດ້ · ${totals?.vehicles_without_fuel ?? 0} ຄັນວັດບໍ່ໄດ້`
              }
            />
            <Stat label="ໄລຍະທາງລວມ" value={`${num(totalDistance, 0)} ກມ`} hint={`ສະເລ່ຍ ${num(totalDistance / Math.max(1, table.length), 0)} ກມ/ຄັນ`} />
            <Stat
              label="ກມ/ລິດ (ສະເລ່ຍ)"
              value={saneLitre > 0 ? num(saneKm / saneLitre, 1) : "—"}
              hint={odd.length > 0 ? `ຈາກ ${measured.length} ຄັນທີ່ວັດໄດ້ຈິງ · ຄ່າກາງ fleet ${num(fleetKmPerLitre ?? 0, 1)}` : `ຈາກ ${measured.length} ຄັນ`}
              tone="emerald"
            />
            <Stat
              label="ເຫດການເຕີມ (ເຊັນເຊີ)"
              value={`${refuelEventCount} ຄັ້ງ`}
              hint={`≈ ${Math.round(refuelRows.reduce((s, r) => s + r.rep.litre, 0))} ລິດ ຈາກ ${refuelRows.filter((r) => r.rep.events.length > 0).length} ຄັນ`}
            />
            <Stat
              label="ນ້ຳມັນຫຼຸດຂະນະຈອດ"
              value={`${dropCount} ຄັ້ງ`}
              hint={dropCount > 0 ? "ຄວນກວດທີ່ໜ້າ ✅ ກວດເຫດການ" : "ບໍ່ພົບ"}
              tone={dropCount > 0 ? "rose" : "emerald"}
            />
          </section>

          {(odd.length > 0 || multiDay) && (
            <div className="space-y-2">
              {odd.length > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  🧪 ແກ້ຄ່າ {odd.length} ຄັນ ທີ່ Lao GPS ຄິດຢູ່ນອກຊ່ວງທີ່ເປັນໄປໄດ້ ({SANE_MIN}–{SANE_MAX} ກມ/ລິດ) ໂດຍປະມານຈາກມາດຕະຖານແທນ —{" "}
                  {odd.slice(0, 6).map((r) => `${r.plate} (ດິບ ${num(r.reported ?? 0, 0)} ລ → ${num(r.litre ?? 0, 0)} ລ)`).join(" · ")}
                  {odd.length > 6 && " …"} · ຕົ້ນເຫດມັກເປັນຂະໜາດຖັງ/ອັດຕາທີ່ຕັ້ງໄວ້ຜິດ ຫຼື ເຊັນເຊີແກວ່ງ ຢູ່ຝັ່ງ Lao GPS
                </p>
              )}
              {multiDay && (
                <p className="text-xs text-muted">
                  ຊ່ວງຫຼາຍວັນ: ລົດແບບ sensor ໃຊ້ຍອດ “ລວມລາຍວັນ” ເຊິ່ງໃກ້ຄວາມຈິງກວ່າ ເພາະການເຕີມນ້ຳມັນນ້ອຍໆລະຫວ່າງວັນຈະບໍ່ຫາຍໄປ.
                </p>
              )}
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-bold">ນ້ຳມັນ ຕໍ່ຄັນ ({table.length})</h2>
                <p className="mt-0.5 text-xs text-muted">ຮຽງຕາມນ້ຳມັນຫຼາຍຫານ້ອຍ · ກົດເລກທະບຽນເພື່ອເບິ່ງປະຫວັດການເຕີມຂອງຄັນນັ້ນ</p>
              </div>
              <div className="flex gap-2 text-[11px] print:hidden">
                <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700">ເຊັນເຊີຖັງ</span>
                <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">ອັດຕາ ກມ/ລິດ</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">≈ ຄ່າປະມານ (ແກ້ແລ້ວ)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <th className="sticky left-0 z-30 w-12 border-b border-r border-border bg-slate-50 px-3 py-3 text-center">#</th>
                    <th className="sticky left-12 z-30 min-w-48 border-b border-r border-border bg-slate-50 px-4 py-3">ລົດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3">ພະແນກ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ນ້ຳມັນ (ລິດ)</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ໄລຍະທາງ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ກມ/ລິດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເວລາແລ່ນ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເຕີມ (ເຊັນເຊີ)</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3">ວິທີວັດ</th>
                  </tr>
                </thead>
                <tbody>
                  {table.length === 0 && <EmptyRow colSpan={9} text="ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້" />}
                  {table.map((r, index) => {
                    const zebra = index % 2 === 1;
                    const sticky = zebra ? "bg-slate-50" : "bg-card";
                    const refuelCount = r.rep?.events.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED").length ?? 0;
                    return (
                      <tr key={r.imei} className={`hover:bg-slate-50 ${zebra ? "bg-slate-50/50" : ""}`}>
                        <td className={`sticky left-0 z-20 border-b border-r border-border px-3 py-3 text-center tabular text-muted ${sticky}`}>{index + 1}</td>
                        <td className={`sticky left-12 z-20 border-b border-r border-border px-4 py-3 ${sticky}`}>
                          {r.vehicleId ? (
                            <Link href={`/fleet/vehicles/${r.vehicleId}`} className="font-bold text-slate-800 hover:text-primary hover:underline">
                              {r.plate}
                            </Link>
                          ) : (
                            <span className="font-bold text-slate-800">{r.plate}</span>
                          )}
                          <span className="mt-0.5 block text-[10px] text-muted">
                            {r.name || r.imei}
                            {!r.inHrm && <span className="ml-1 text-amber-600">(ບໍ່ຢູ່ໃນ HRM)</span>}
                            {r.partial && <span className="ml-1 text-amber-600">ຂໍ້ມູນບໍ່ຄົບ</span>}
                          </span>
                        </td>
                        <td className="border-b border-border px-4 py-3 text-[11px] text-muted">{r.department ?? "—"}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular font-bold">
                          {r.litre == null ? (
                            <span className="font-normal text-muted">—</span>
                          ) : r.estimated ? (
                            <span
                              className="text-amber-700"
                              title={`ຄ່າດິບ GPS ${num(r.reported ?? 0, 1)} ລ ເປັນໄປບໍ່ໄດ້ — ປະມານຈາກ ${r.norm ? `${num(r.norm.kmPerLitre, 1)} ກມ/ລິດ (${NORM_SOURCE_LABEL[r.norm.source]})` : "ມາດຕະຖານ"}`}
                            >
                              ≈ {num(r.litre, 2)}
                            </span>
                          ) : (
                            num(r.litre, 2)
                          )}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{num(r.distance, 1)}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">
                          {r.kmPerL == null ? <span className="text-muted">—</span> : <span className={r.estimated ? "text-amber-700" : ""}>{num(r.kmPerL, 1)}</span>}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{num(r.driveHours, 1)}</td>
                        <td className="border-b border-border px-4 py-3 text-right text-[11px]">
                          {r.method !== "sensor" ? (
                            <span className="text-muted">—</span>
                          ) : r.rep?.note ? (
                            <span className="text-amber-600" title={r.rep.note}>⚠️ ເຊັນເຊີ</span>
                          ) : refuelCount > 0 ? (
                            <span className="font-semibold">
                              ⛽ {refuelCount} ຄັ້ງ · ≈{Math.round(r.rep?.litre ?? 0)} ລ
                              {r.rep?.events.some((e) => e.kind === "DROP") && <span className="ml-1 text-rose-600">🩸</span>}
                              {r.rep?.events.some((e) => e.kind === "REFUEL" && (e.confidence ?? "CHECK") === "CHECK") && (
                                <span className="ml-1 text-amber-600">🟡</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">ບໍ່ມີ</span>
                          )}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-[11px]">
                          {r.method === "sensor" && <Badge tone="blue">ເຊັນເຊີຖັງ</Badge>}
                          {r.method === "rate" && <Badge tone="violet">ອັດຕາ ກມ/ລິດ</Badge>}
                          {r.method == null && <span className="text-muted">{fuelReasonLabel(r.reason)}</span>}
                          {r.estimated && (
                            <Badge tone="amber">ປະມານ{r.norm ? ` · ${NORM_SOURCE_LABEL[r.norm.source]}` : ""}</Badge>
                          )}
                          {r.clamped && <span className="ml-2 text-amber-600">ຈຳກັດທີ່ຂະໜາດຖັງ</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {table.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td className="sticky left-0 z-20 border-t border-r border-border bg-slate-100 px-3 py-3" />
                      <td className="sticky left-12 z-20 border-t border-r border-border bg-slate-100 px-4 py-3">ລວມ {table.length} ຄັນ</td>
                      <td className="border-t border-border px-4 py-3" />
                      <td className="border-t border-border px-4 py-3 text-right tabular">{totalLitre != null ? num(totalLitre, 1) : "—"}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalDistance, 1)}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{saneLitre > 0 ? num(saneKm / saneLitre, 1) : "—"}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{num(table.reduce((s, r) => s + r.driveHours, 0), 1)}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{refuelEventCount} ຄັ້ງ</td>
                      <td className="border-t border-border px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {refuelRows.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="font-bold">⛽ ການເຕີມທີ່ເຊັນເຊີຈັບໄດ້ ({refuelEventCount} ຄັ້ງ · {refuelRows.length} ຄັນ)</h2>
                  <p className="mt-0.5 text-[11px] text-muted">
                    ນັບເມື່ອລົດ<b>ຈອດ</b> (≥ 90 ວິ) ແລະ ນ້ຳມັນ<b>ເພີ່ມຂຶ້ນລະຫວ່າງຈອດ</b> ≥ 10% · ຄວາມລະອຽດ ≈ ±3–4 ລິດ ·
                    ລາຍລະອຽດແຕ່ລະຄັ້ງ ແລະ ການຢືນຢັນ ຢູ່ໜ້າ “ກວດເຫດການນ້ຳມັນ”
                  </p>
                </div>
                <Link href="/fleet/fuel/review" className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-[#5d3e55] print:hidden">
                  ✅ ກວດ / ຢືນຢັນ ທັງໝົດ →
                </Link>
              </div>
              <ul className="divide-y divide-border text-xs">
                {refuelRows.map(({ imei, rep, label, vehicleId }) => {
                  const drops = rep.events.filter((e) => e.kind === "DROP");
                  const check = rep.events.filter((e) => e.kind === "REFUEL" && (e.confidence ?? "CHECK") === "CHECK");
                  const latest = rep.events.reduce<string | null>((a, e) => (a && a > e.time ? a : e.time), null);
                  return (
                    <li key={imei} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {vehicleId ? (
                            <Link href={`/fleet/vehicles/${vehicleId}`} className="hover:text-primary hover:underline">{label}</Link>
                          ) : (
                            label
                          )}
                        </span>
                        <span className="ml-2 text-muted">
                          {rep.events.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED").length} ຄັ້ງ · ≈{Math.round(rep.litre)} ລິດ
                          {latest && ` · ຫຼ້າສຸດ ${fmtLao(latest)}`}
                        </span>
                        {rep.note && <span className="block text-[11px] text-amber-700">⚠️ {rep.note}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {drops.length > 0 && (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            🩸 ຫຼຸດ {drops.length} ຄັ້ງ · {Math.round(drops.reduce((a, e) => a + e.litre, 0))} ລ
                          </span>
                        )}
                        {check.length > 0 && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">🟡 ກວດ {check.length}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

        </>
      )}
    </div>
  );
}
