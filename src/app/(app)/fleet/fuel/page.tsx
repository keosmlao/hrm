import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
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
import Link from "next/link";
import { aggregateFuelDaily, fuelCacheUpdatedAt, fuelDailyRows, fuelSyncStates, refuelEventsBetween, type RefuelRow } from "@/lib/fuel-cache";
import { RefuelBadge } from "./refuel-badge";
import { GpsFilter, GpsNotConfigured, GpsNotice } from "../gps-filter";

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

export default async function FleetFuelPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const { from, to, note } = resolveRange(q.from, q.to, MAX_DAYS);

  const header = (
    <PageHeader
      title="ລາຍງານນ້ຳມັນ"
      subtitle="ຍອດການໃຊ້ນ້ຳມັນທີ່ວັດ/ຄຳນວນໂດຍແພລດຟອມ GPS · ບໍ່ແມ່ນຄ່າດິບຈາກເຊັນເຊີ"
    />
  );

  if (!laoGpsConfigured()) return <>{header}<GpsNotConfigured /></>;

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
  const [cacheAt, syncStates] = await Promise.all([fuelCacheUpdatedAt(), fuelSyncStates()]);

  // ລົດຄັນໃດຢູ່ໃນ HRM ແດ່ — ຈະໄດ້ຮູ້ວ່າອັນໃດເປັນລົດຂອງພວກເຮົາ
  const hrmVehicles = await gpsVehicleOptions();
  const hrmByImei = new Map(hrmVehicles.map((vehicle) => [vehicle.imei.trim(), vehicle]));
  const hrmImei = new Set(hrmByImei.keys());

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
    .map(([imei, rep]) => ({ imei, rep, label: usefulVehicleLabel(hrmByImei.get(imei)?.plateNo) ?? usefulVehicleLabel(hrmByImei.get(imei)?.name) ?? plateByImei.get(imei) ?? imei }))
    .sort((a, b) => b.rep.litre - a.rep.litre);

  return (
    <>
      {header}
      <GpsFilter action="/fleet/fuel" from={from} to={to} maxDays={MAX_DAYS} note={note} />
      <p className="-mt-2 mb-4 text-xs text-muted">
        {source === "cache"
          ? `ຂໍ້ມູນຈາກ cache · ອັບເດດຫຼ້າສຸດ ${cacheAt ? cacheAt.toLocaleString("en-GB", { timeZone: "Asia/Vientiane", hour12: false }) : "—"} (sync ທຸກຊົ່ວໂມງ)`
          : "ຂໍ້ມູນສົດຈາກ Lao GPS (cache ຍັງບໍ່ມີຊ່ວງນີ້ — ຊ້າກວ່າປົກກະຕິ)"}
      </p>

      {error && <GpsNotice title="ດຶງລາຍງານນ້ຳມັນບໍ່ໄດ້" detail={error} />}

      {rows && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="ນ້ຳມັນລວມ"
              value={totals?.fuel_used_litre != null ? `${num(totals.fuel_used_litre, 1)} ລິດ` : "—"}
              hint={`${from} → ${to}`}
            />
            <StatCard label="ໄລຍະທາງລວມ" value={`${num(totals?.distance_km)} ກມ`} />
            <StatCard label="ລົດທີ່ວັດນ້ຳມັນໄດ້" value={totals?.vehicles_with_fuel ?? 0} tone="good" />
            <StatCard
              label="ລົດທີ່ວັດບໍ່ໄດ້"
              value={totals?.vehicles_without_fuel ?? 0}
              tone={(totals?.vehicles_without_fuel ?? 0) > 0 ? "warn" : "default"}
              hint="ຍັງບໍ່ໄດ້ຕັ້ງຖັງ/ເຊັນເຊີ ຫຼື ອຸປະກອນ offline"
            />
          </div>

          {multiDay && (
            <p className="text-xs text-muted">
              ຊ່ວງຫຼາຍວັນ: ລົດແບບ sensor ໃຊ້ຍອດ “ລວມລາຍວັນ” ເຊິ່ງໃກ້ຄວາມຈິງກວ່າ
              ເພາະການເຕີມນ້ຳມັນນ້ອຍໆລະຫວ່າງວັນຈະບໍ່ຫາຍໄປ.
            </p>
          )}

          <Table>
            <thead>
              <tr>
                <Th className="w-16 text-center">ລຳດັບ</Th>
                <Th>ລົດ</Th>
                <Th className="text-right">ນ້ຳມັນ (ລິດ)</Th>
                <Th className="text-right">ໄລຍະທາງ</Th>
                <Th className="text-right">ກມ/ລິດ</Th>
                <Th className="text-right">ເວລາແລ່ນ</Th>
                <Th className="text-right">ເຕີມ (ເຊັນເຊີ)</Th>
                <Th>ວິທີວັດ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={8} text="ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້" />}
              {[...rows]
                .sort((a, b) => (fuelLitreForDisplay(b) ?? -1) - (fuelLitreForDisplay(a) ?? -1))
                .map((r, index) => {
                  const litre = fuelLitreForDisplay(r);
                  const kmPerL = litre && litre > 0 ? r.distance_km / litre : null;
                  const imei = r.imei.trim();
                  const hrmVehicle = hrmByImei.get(imei);
                  const vehiclePlate = usefulVehicleLabel(hrmVehicle?.plateNo) ?? usefulVehicleLabel(r.plate);
                  const vehicleName = usefulVehicleLabel(hrmVehicle?.name) ?? usefulVehicleLabel(r.name);
                  const rep = refuels.get(imei);
                  return (
                    <tr key={r.imei}>
                      <Td className="text-center tabular text-muted">{index + 1}</Td>
                      <Td className="font-medium">
                        {vehiclePlate ?? vehicleName ?? imei}
                        {vehiclePlate && vehicleName && (
                          <span className="block text-xs font-normal text-muted">{vehicleName}</span>
                        )}
                        {!hrmImei.has(imei) && (
                          <span className="ml-2 text-xs font-normal text-muted">(ບໍ່ຢູ່ໃນ HRM)</span>
                        )}
                        {r.partial_data && (
                          <span className="ml-2 text-xs font-normal text-amber-600">ຂໍ້ມູນບໍ່ຄົບ</span>
                        )}
                      </Td>
                      <Td className="text-right tabular font-semibold">
                        {litre != null ? num(litre, 2) : <span className="font-normal text-muted">—</span>}
                      </Td>
                      <Td className="text-right tabular">{num(r.distance_km)}</Td>
                      <Td className="text-right tabular">{num(kmPerL, 1)}</Td>
                      <Td className="text-right tabular">{num(r.drive_hours)}</Td>
                      <Td className="text-right tabular text-xs">
                        {r.fuel_method !== "sensor" ? (
                          <span className="text-muted">—</span>
                        ) : rep?.note ? (
                          <span className="text-amber-600" title={rep.note}>⚠️ ເຊັນເຊີ</span>
                        ) : rep?.events.length ? (
                          <span className="font-semibold">
                            ⛽ {rep.events.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED").length} ຄັ້ງ · ≈{Math.round(rep.litre)} ລ
                            {rep.events.some((e) => e.kind === "DROP") && <span className="ml-1 text-rose-600">🩸</span>}
                            {rep.events.some((e) => e.kind === "REFUEL" && (e.confidence ?? "CHECK") === "CHECK") && <span className="ml-1 text-amber-600">🟡</span>}
                          </span>
                        ) : (
                          <span className="text-muted">ບໍ່ມີ</span>
                        )}
                      </Td>
                      <Td className="text-xs">
                        {r.fuel_method === "sensor" && <Badge tone="blue">ເຊັນເຊີຖັງ</Badge>}
                        {r.fuel_method === "rate" && <Badge tone="violet">ອັດຕາ ກມ/ລິດ</Badge>}
                        {r.fuel_method == null && (
                          <span className="text-muted">{fuelReasonLabel(r.fuel_reason)}</span>
                        )}
                        {r.clamped && <span className="ml-2 text-amber-600">ຈຳກັດທີ່ຂະໜາດຖັງ</span>}
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>

          {refuelRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">⛽ ເຫດການເຕີມນ້ຳມັນ (ຈາກເຊັນເຊີຖັງ)</h2>
                <Link href="/fleet/fuel/stations" className="text-sm text-primary hover:underline">📍 ຈຸດເຕີມ (geofence) →</Link>
              </div>
              <p className="mt-1 text-xs text-muted">
                ນັບເມື່ອລົດ<b>ຈອດ</b> (≥ 90 ວິ) ແລະ ນ້ຳມັນ<b>ເພີ່ມຂຶ້ນລະຫວ່າງຈອດ</b> ≥ 10% · ຄວາມໝັ້ນໃຈ: ✅ ມີບິນ/ຄົນຂັບຢືນຢັນ · 🟢 ຢູ່ຈຸດເຕີມ ຫຼື ≥ 15 L + ຜ່ານກວດ · 🟡 ນ້ອຍ/ນອກຈຸດເຕີມ ໃຫ້ກວດ · 🩸 ນ້ຳມັນຫຼຸດຂະນະຈອດ · ຄວາມລະອຽດ ≈ ±3–4 ລິດ
              </p>
              <div className="mt-3 space-y-3">
                {refuelRows.map(({ imei, rep, label }) => (
                  <div key={imei} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium">
                      {label}
                      <span className="ml-2 text-xs font-normal text-muted">{rep.events.length} ຄັ້ງ · ≈{Math.round(rep.litre)} ລິດ</span>
                    </p>
                    {rep.note && <p className="mt-1 text-xs text-amber-700">⚠️ {rep.note}</p>}
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">
                      {rep.events.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="min-w-0">
                            <span className="block truncate">
                              {e.kind === "DROP" ? "🩸" : "⛽"} {fmtLao(e.time)} · {e.beforePercent}% → {e.afterPercent}%
                              <span className="text-muted"> · 🅿 ຈອດ {fmtHM(e.stopStart)}–{fmtHM(e.stopEnd)} ({e.stopMinutes} ນາທີ)</span>
                              {e.address ? <span className="text-muted"> · {e.address}</span> : null}
                            {e.lat != null && e.lng != null && (
                              <>
                                {" · "}
                                <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">ແຜນທີ່</a>
                              </>
                            )}
                            </span>
                            <span className="mt-0.5 block"><RefuelBadge e={e} /></span>
                          </span>
                          <span className={`shrink-0 font-semibold ${e.kind === "DROP" ? "text-rose-700" : e.confidence === "REJECTED" ? "text-slate-400 line-through" : "text-emerald-700"}`}>
                            ≈ {e.kind === "DROP" ? "−" : "+"}{e.litre} ລິດ
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function fmtHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Vientiane", hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtLao(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { timeZone: "Asia/Vientiane", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
}
