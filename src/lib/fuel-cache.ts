import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getHistory, listFuel, listVehicles, type LaoGpsFuel } from "@/lib/laogps";
import { detectRefuels, type RefuelEvent } from "@/lib/fuel-events";

/**
 * ⛽ Cache ນ້ຳມັນ Lao GPS ໃນ DB (db/2026-08-18-fuel-cache.sql ຝັ່ງ SALE)
 *
 * Open API ຄິດຄ່າສົດທຸກຄຳຂໍ: /fuel 7 ວັນທັງບັນຊີ ≈ 90 ວິ · /history 1 ຄັນ ≈ 1–200 ວິ (ແກວ່ງຕາມ cache ຂອງເຂົາ)
 * → ໜ້າເວັບອ່ານຈາກ 3 ຕາຕະລາງນີ້ (ms) ແລະ ໃຫ້ cron `npm run gps:sync-fuel` ເປັນຄົນເອີ້ນ API
 *   hrm_vehicle_fuel_daily    ນ້ຳມັນ/ໄລຍະ ລາຍວັນ ຕໍ່ລົດ (ຕົວເລກ Lao GPS — /fuel?from=day&to=day ≈ 1.5 ວິ/ວັນ)
 *   hrm_vehicle_refuel_event  ເຫດການເຕີມ ຈາກເຊັນເຊີ (detectRefuels)
 *   hrm_vehicle_fuel_sync     watermark + ໝາຍເຫດ ຕໍ່ລົດ
 *
 * ⚠ ເວລາ: ຫ້າມສົ່ງ Date ເປັນ parameter ຂອງ $queryRaw/$executeRaw ໂດຍກົງ — adapter-pg ສົ່ງເປັນ naive local
 *   ແລ້ວ Postgres (tz Asia/Bangkok) ຕີຄວາມຜິດ 7 ຊມ. ໃຊ້ `${d.toISOString()}::timestamptz` ແລະ ອ່ານຄືນດ້ວຍ to_char(... at time zone 'UTC')
 */

// ── ອ່ານ ────────────────────────────────────────────────────────────────

export type FuelDailyRow = {
  imei: string;
  day: string;
  vehicle_id: number | null;
  plate: string | null;
  distance_km: number;
  drive_hours: number;
  idle_hours: number;
  fuel_used_litre: number | null;
  fuel_used_percent: number | null;
  fuel_method: "sensor" | "rate" | null;
  fuel_reason: string | null;
  tank_litre: number | null;
  km_per_litre: number | null;
  clamped: boolean;
  sample_count: number;
  partial_data: boolean;
};

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const nn = (v: unknown): number | null => (v == null ? null : Number(v));

/** ແຖວລາຍວັນ ຂອງທຸກຄັນ (ຫຼື ສະເພາະ imeis) ໃນຊ່ວງ from..to (YYYY-MM-DD) */
export async function fuelDailyRows(from: string, to: string, imeis?: string[]): Promise<FuelDailyRow[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select imei, day::text as "day", vehicle_id, plate, distance_km, drive_hours, idle_hours,
           fuel_used_litre, fuel_used_percent, fuel_method, fuel_reason, tank_litre, km_per_litre,
           clamped, sample_count, partial_data
      from hrm_vehicle_fuel_daily
     where day between ${from}::date and ${to}::date
       ${imeis?.length ? Prisma.sql`and imei in (${Prisma.join(imeis)})` : Prisma.empty}
     order by imei, day`;
  return rows.map((r) => ({
    imei: String(r.imei),
    day: String(r.day),
    vehicle_id: r.vehicle_id == null ? null : Number(r.vehicle_id),
    plate: (r.plate as string | null) ?? null,
    distance_km: n(r.distance_km),
    drive_hours: n(r.drive_hours),
    idle_hours: n(r.idle_hours),
    fuel_used_litre: nn(r.fuel_used_litre),
    fuel_used_percent: nn(r.fuel_used_percent),
    fuel_method: (r.fuel_method as "sensor" | "rate" | null) ?? null,
    fuel_reason: (r.fuel_reason as string | null) ?? null,
    tank_litre: nn(r.tank_litre),
    km_per_litre: nn(r.km_per_litre),
    clamped: r.clamped === true,
    sample_count: n(r.sample_count),
    partial_data: r.partial_data === true,
  }));
}

/**
 * ລວມແຖວລາຍວັນ ເປັນຮູບ LaoGpsFuel ຕໍ່ລົດ (ໜ້າລາຍງານໃຊ້ helper ເດີມ fuelLitreForDisplay ໄດ້)
 * ນ້ຳມັນຫຼາຍວັນ = ຜົນບວກລາຍວັນ (ວິທີ "daily_sum" ທີ່ Lao GPS ແນະນຳ ສຳລັບ sensor) — rate ກໍບວກໄດ້ຄືກັນ
 */
export function aggregateFuelDaily(rows: FuelDailyRow[]): LaoGpsFuel[] {
  const by = new Map<string, FuelDailyRow[]>();
  for (const r of rows) (by.get(r.imei) ?? by.set(r.imei, []).get(r.imei)!).push(r);
  const out: LaoGpsFuel[] = [];
  for (const [imei, list] of by) {
    const withFuel = list.filter((r) => r.fuel_used_litre != null);
    const litre = withFuel.length ? withFuel.reduce((s, r) => s + (r.fuel_used_litre ?? 0), 0) : null;
    const last = list[list.length - 1];
    const method = [...list].reverse().find((r) => r.fuel_method)?.fuel_method ?? null;
    const distance = list.reduce((s, r) => s + r.distance_km, 0);
    const kmL = litre && litre > 0 ? distance / litre : null;
    out.push({
      vehicle_id: last.vehicle_id ?? 0,
      imei,
      plate: last.plate,
      name: null,
      distance_km: distance,
      drive_hours: list.reduce((s, r) => s + r.drive_hours, 0),
      idle_hours: list.reduce((s, r) => s + r.idle_hours, 0),
      fuel_used_litre: litre,
      fuel_used_percent: withFuel.length ? withFuel.reduce((s, r) => s + (r.fuel_used_percent ?? 0), 0) : null,
      fuel_used_litre_daily_sum: method === "sensor" ? litre : null,
      fuel_method: method,
      fuel_reason: method ? null : ([...list].reverse().find((r) => r.fuel_reason)?.fuel_reason ?? null),
      tank_litre: last.tank_litre,
      km_per_litre: kmL,
      moving_litre: null,
      redlight_litre: null,
      idle_litre: null,
      clamped: list.some((r) => r.clamped),
      sample_count: list.reduce((s, r) => s + r.sample_count, 0),
      partial_data: list.some((r) => r.partial_data) || withFuel.length < list.length,
      daily: list.map((r) => ({ day: r.day, distance_km: r.distance_km, drive_hours: r.drive_hours, fuel_used_litre: r.fuel_used_litre, fuel_method: r.fuel_method, sample_count: r.sample_count })),
    });
  }
  return out;
}

export type RefuelRow = RefuelEvent & {
  id: string;
  imei: string;
  /** ຜົນການໃຫ້ຄະແນນ (scoreRefuelEvents) */
  confidence: "CONFIRMED" | "LIKELY" | "CHECK" | "REJECTED" | null;
  checks: RefuelChecks | null;
  stationId: string | null;
  stationName: string | null;
  receiptExpenseId: string | null;
  confirmStatus: "CONFIRMED" | "REJECTED" | null;
  confirmedBy: string | null;
  confirmNote: string | null;
};
export type RefuelChecks = { station: boolean; receipt: boolean; litreOk: boolean; rateOk: boolean; sizeOk: boolean };

/** ເຫດການເຕີມ ໃນຊ່ວງ from..to (instant) — ທຸກຄັນ ຫຼື ສະເພາະ imeis */
export async function refuelEventsBetween(from: Date, to: Date, imeis?: string[]): Promise<RefuelRow[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select e.id::text id, e.imei, e.kind, to_char(e.event_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') "time",
           e.before_pct, e.after_pct, e.litre, e.lat, e.lng, e.address,
           to_char(coalesce(e.stop_start, e.event_time) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') stop_start,
           to_char(coalesce(e.stop_end, e.event_time) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') stop_end,
           coalesce(e.stop_minutes, 0) stop_minutes,
           e.confidence, e.checks, e.station_id::text station_id, st.name station_name, e.receipt_expense_id,
           e.confirm_status, e.confirmed_by, e.confirm_note
      from hrm_vehicle_refuel_event e
      left join hrm_fuel_station st on st.id = e.station_id
     where e.event_time >= ${from.toISOString()}::timestamptz and e.event_time < ${to.toISOString()}::timestamptz
       ${imeis?.length ? Prisma.sql`and e.imei in (${Prisma.join(imeis)})` : Prisma.empty}
     order by e.imei, e.event_time`;
  return rows.map((r) => ({
    id: String(r.id),
    imei: String(r.imei),
    kind: (r.kind as "REFUEL" | "DROP") ?? "REFUEL",
    time: String(r.time),
    beforePercent: n(r.before_pct),
    afterPercent: n(r.after_pct),
    litre: n(r.litre),
    lat: nn(r.lat),
    lng: nn(r.lng),
    address: (r.address as string | null) ?? null,
    stopStart: String(r.stop_start),
    stopEnd: String(r.stop_end),
    stopMinutes: n(r.stop_minutes),
    confidence: (r.confidence as RefuelRow["confidence"]) ?? null,
    checks: (r.checks as RefuelChecks | null) ?? null,
    stationId: (r.station_id as string | null) ?? null,
    stationName: (r.station_name as string | null) ?? null,
    receiptExpenseId: (r.receipt_expense_id as string | null) ?? null,
    confirmStatus: (r.confirm_status as RefuelRow["confirmStatus"]) ?? null,
    confirmedBy: (r.confirmed_by as string | null) ?? null,
    confirmNote: (r.confirm_note as string | null) ?? null,
  }));
}

/** ຂະໜາດຖັງ (ລິດ) ຕໍ່ imei — ໃຊ້ແປງ % ເປັນລິດ ໃຫ້ຄົນອ່ານເຂົ້າໃຈງ່າຍ */
export async function vehicleTankLitres(): Promise<Map<string, number>> {
  // ⚠ ຢ່າໃຊ້ `day` ເປັນ alias — Postgres ຖືເປັນ keyword (ເຄີຍພັງ: syntax error at or near "day")
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select imei, tank_litre from (
      select imei, tank_litre, 1 as pri
        from hrm_vehicle_gps
       where tank_litre > 0
      union all
      select imei, tank_litre, 2 as pri
        from (
          select distinct on (imei) imei, tank_litre
            from hrm_vehicle_fuel_daily
           where tank_litre > 0
           order by imei, day desc
        ) latest
    ) t
    order by pri`;
  const out = new Map<string, number>();
  for (const r of rows) {
    const imei = String(r.imei).trim();
    const tank = Number(r.tank_litre);
    if (imei && Number.isFinite(tank) && tank > 0 && !out.has(imei)) out.set(imei, tank);
  }
  return out;
}

export type FuelSyncState = { imei: string; refuelSyncedTo: Date | null; note: string | null; lastError: string | null; updatedAt: Date };

export async function fuelSyncStates(): Promise<Map<string, FuelSyncState>> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select imei, note, last_error,
           -- ອ່ານເປັນ ISO UTC ເອງ — Prisma raw + adapter-pg ຄືນ timestamptz ເປັນ Date ຜິດ zone (+7 ຊມ) ເຮັດ watermark ກະໂດດ
           to_char(refuel_synced_to at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') synced_iso,
           to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') updated_iso
      from hrm_vehicle_fuel_sync`;
  return new Map(
    rows.map((r) => [
      String(r.imei),
      {
        imei: String(r.imei),
        refuelSyncedTo: r.synced_iso ? new Date(String(r.synced_iso)) : null,
        note: (r.note as string | null) ?? null,
        lastError: (r.last_error as string | null) ?? null,
        updatedAt: new Date(String(r.updated_iso)),
      },
    ]),
  );
}

/** ເວລາ sync ຫຼ້າສຸດ (ໄວ້ບອກຜູ້ໃຊ້ວ່າຂໍ້ມູນເກົ່າປານໃດ) */
export async function fuelCacheUpdatedAt(): Promise<Date | null> {
  const rows = await prisma.$queryRaw<{ at: string | null }[]>`
    select to_char(max(synced_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') "at" from hrm_vehicle_fuel_daily`;
  return rows[0]?.at ? new Date(rows[0].at) : null;
}

// ── ຂຽນ (cron) ───────────────────────────────────────────────────────────

const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" }); // YYYY-MM-DD ເວລາລາວ

/**
 * ດຶງ /fuel ວັນລະຄຳຂໍ (ທຸກຄັນ) ຍ້ອນຫຼັງ `days` ວັນ (ຮວມມື້ນີ້) → upsert hrm_vehicle_fuel_daily
 * ວັນດຽວຄິດໄວ (~1.5 ວິ) ແລະ ຕົວເລກຕໍ່ວັນຄົງທີ່ — ວັນເກົ່າ sync ຄືນໄດ້ຢ່າງປອດໄພ
 */
export async function syncFuelDaily(days: number, log: (s: string) => void = () => {}): Promise<number> {
  let written = 0;
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = day(new Date(today.getTime() - i * 86_400_000));
    const t0 = Date.now();
    const { data } = await listFuel({ from: d, to: d });
    for (const f of data) {
      const imei = f.imei.trim();
      if (!imei) continue;
      await prisma.$executeRaw`
        insert into hrm_vehicle_fuel_daily
          (imei, day, vehicle_id, plate, distance_km, drive_hours, idle_hours, fuel_used_litre, fuel_used_percent,
           fuel_method, fuel_reason, tank_litre, km_per_litre, clamped, sample_count, partial_data, synced_at)
        values (${imei}, ${d}::date, ${f.vehicle_id}, ${f.plate}, ${f.distance_km ?? 0}, ${f.drive_hours ?? 0}, ${f.idle_hours ?? 0},
                ${f.fuel_used_litre}, ${f.fuel_used_percent}, ${f.fuel_method}, ${f.fuel_reason}, ${f.tank_litre}, ${f.km_per_litre},
                ${f.clamped === true}, ${f.sample_count ?? 0}, ${f.partial_data === true}, now())
        on conflict (imei, day) do update set
          vehicle_id = excluded.vehicle_id, plate = excluded.plate, distance_km = excluded.distance_km,
          drive_hours = excluded.drive_hours, idle_hours = excluded.idle_hours, fuel_used_litre = excluded.fuel_used_litre,
          fuel_used_percent = excluded.fuel_used_percent, fuel_method = excluded.fuel_method, fuel_reason = excluded.fuel_reason,
          tank_litre = excluded.tank_litre, km_per_litre = excluded.km_per_litre, clamped = excluded.clamped,
          sample_count = excluded.sample_count, partial_data = excluded.partial_data, synced_at = now()`;
      written++;
    }
    log(`fuel ${d}: ${data.length} ຄັນ (${Date.now() - t0} ms)`);
  }
  return written;
}

const CHUNK_MS = 24 * 3600_000;
const OVERLAP_MS = 60 * 60_000;

/**
 * ຫາເຫດການເຕີມ ຂອງລົດທຸກຄັນ ຕັ້ງແຕ່ watermark (ຫຼື `backfillDays` ວັນ ຖ້າຍັງບໍ່ເຄີຍ sync) ຮອດຕອນນີ້
 * ຂໍ history ເປັນທ່ອນ ≤ 24 ຊມ (ທ່ອນສັ້ນ ຄິດໄວກວ່າ) · ທັບຊ້ອນ 1 ຊມ ກັນ median window ຂາດ
 * ຄວາມພ້ອມກັນ `concurrency` ຄັນ — provider ຊ້າ ຢ່າຖົມ
 *
 * `rescanDays` = ບັງຄັບສະແກນຄືນ N ວັນຫຼ້າສຸດ ເຖິງແມ່ນ watermark ຈະໃໝ່ກວ່ານັ້ນ (ສູງສຸດ 31 ວັນ —
 * ໃຊ້ຕອນ backfill ຫຼື ຫຼັງແກ້ logic ການຈັບ; ຮອບ cron ປົກກະຕິຢ່າໃສ່ ຈະໜັກໂດຍບໍ່ຈຳເປັນ)
 */
export async function syncRefuels(opts: { backfillDays?: number; rescanDays?: number; concurrency?: number; log?: (s: string) => void } = {}): Promise<{ vehicles: number; events: number }> {
  const log = opts.log ?? (() => {});
  const backfill = (opts.backfillDays ?? 7) * 86_400_000;
  const rescan = opts.rescanDays ? opts.rescanDays * 86_400_000 : 0;
  // ⚠ ຢ່າກັ່ນດ້ວຍ `fuel_capability.method === "sensor"` — Lao GPS ຕິດປ້າຍ "rate" ໃຫ້ 7 ຄັນ
  // ທັງທີ່ຈຸດ GPS ຂອງເຂົາມີ fuel_percent ຄົບທຸກຈຸດ (ກວດແລ້ວ 2026-08-18). ປ້າຍນັ້ນເປັນວິທີທີ່
  // ເຂົາເລືອກຄິດ "ລິດທີ່ໃຊ້" ເທົ່ານັ້ນ ບໍ່ໄດ້ແປວ່າບໍ່ມີເຊັນເຊີ — detectRefuels ອ່ານ % ເອງ.
  // ເຊັນເຊີຄ້າງ/ບໍ່ຂະຫຍັບ ຍັງຖືກຈັບດ້ວຍການກວດ pctMin/pctMax ຂ້າງລຸ່ມຢູ່ແລ້ວ.
  const vehicles = (await listVehicles({ limit: 500 })).filter((v) => v.imei && v.active && v.fuel_capability?.supported && v.fuel_capability.tank_litre);
  const states = await fuelSyncStates();
  const now = Date.now();
  let events = 0;
  const queue = [...vehicles];
  const worker = async () => {
    for (let v = queue.shift(); v; v = queue.shift()) {
      const imei = v.imei.trim();
      const st = states.get(imei);
      const watermarkStart = st?.refuelSyncedTo ? st.refuelSyncedTo.getTime() - OVERLAP_MS : now - backfill;
      const start = Math.max(rescan ? Math.min(watermarkStart, now - rescan) : watermarkStart, now - 31 * 86_400_000);
      let cursor = start;
      let vehicleEvents = 0;
      let note: string | null = null;
      let noteKnown = false; // ຮອບນີ້ມີຂໍ້ມູນພໍຕັດສິນເລື່ອງເຊັນເຊີບໍ (ຮອບລາຍຊົ່ວໂມງ ມັກບໍ່ພໍ → ຄົງໝາຍເຫດເກົ່າ)
      let err: string | null = null;
      // ສະສົມທັງຮອບ ໄວ້ກວດເຊັນເຊີຄ້າງ (ແລ່ນ > 100 km ແຕ່ % ແກວ່ງ < 3 — ພົບ ລຣ-9977 ອ່ານ 3–5% ຕະຫຼອດ 974 km)
      let pctMin = Infinity;
      let pctMax = -Infinity;
      let kmTotal = 0;
      let sampleTotal = 0;
      try {
        while (cursor < now) {
          const end = Math.min(cursor + CHUNK_MS, now);
          const t0 = Date.now();
          const { data } = await getHistory(imei, { from: new Date(cursor).toISOString(), to: new Date(end).toISOString(), includePoints: true, limit: 20000 });
          const pts = (data.points ?? []).filter((p) => p.fuel_percent != null);
          const found = detectRefuels(data.points ?? [], v.fuel_capability.tank_litre); // ທຸກຈຸດ — ໃຊ້ speed ຫາການຈອດ
          for (const e of found) {
            await prisma.$executeRaw`
              insert into hrm_vehicle_refuel_event (imei, kind, event_time, before_pct, after_pct, litre, lat, lng, address, stop_start, stop_end, stop_minutes)
              values (${imei}, ${e.kind}, ${new Date(e.time).toISOString()}::timestamptz, ${e.beforePercent}, ${e.afterPercent}, ${e.litre}, ${e.lat}, ${e.lng}, ${e.address},
                      ${new Date(e.stopStart).toISOString()}::timestamptz, ${new Date(e.stopEnd).toISOString()}::timestamptz, ${e.stopMinutes})
              on conflict (imei, event_time) do update set
                kind = excluded.kind, before_pct = excluded.before_pct, after_pct = excluded.after_pct, litre = excluded.litre,
                lat = excluded.lat, lng = excluded.lng, address = excluded.address,
                stop_start = excluded.stop_start, stop_end = excluded.stop_end, stop_minutes = excluded.stop_minutes`;
          }
          // ລຶບເຫດການເກົ່າໃນທ່ອນນີ້ທີ່ logic ໃໝ່ບໍ່ພົບແລ້ວ (ຄົງໄວ້ສະເພາະທີ່ຄົນຢືນຢັນ/ປະຕິເສດແລ້ວ) — ກັນຂໍ້ມູນຄ້າງຈາກ version ເກົ່າ
          await prisma.$executeRaw`
            delete from hrm_vehicle_refuel_event
             where imei = ${imei} and confirm_status is null
               and event_time >= ${new Date(cursor).toISOString()}::timestamptz and event_time < ${new Date(end).toISOString()}::timestamptz
               ${found.length ? Prisma.sql`and event_time not in (${Prisma.join(found.map((e) => Prisma.sql`${new Date(e.time).toISOString()}::timestamptz`))})` : Prisma.empty}`;
          vehicleEvents += found.length;
          for (const p of pts) {
            const f = p.fuel_percent as number;
            if (f < pctMin) pctMin = f;
            if (f > pctMax) pctMax = f;
          }
          sampleTotal += pts.length;
          kmTotal += data.summary?.distance_km ?? 0;
          log(`${v.plate ?? imei} ${new Date(cursor).toISOString().slice(0, 16)}→${new Date(end).toISOString().slice(0, 16)}: ${pts.length} ຈຸດ · ເຕີມ ${found.length} (${Date.now() - t0} ms)`);
          cursor = end;
        }
        if (sampleTotal > 0 && kmTotal > 100) {
          noteKnown = true;
          note = pctMax - pctMin < 3 ? `ເຊັນເຊີອາດເພ — ຄ່າຄ້າງ ${pctMin}–${pctMax}% ຕະຫຼອດ ${Math.round(kmTotal)} km · ແຈ້ງ Lao GPS ກວດ` : null;
        }
      } catch (e) {
        err = e instanceof Error ? e.message : String(e);
        log(`✗ ${v.plate ?? imei}: ${err}`);
      }
      // watermark = ບ່ອນທີ່ດຶງສຳເລັດ (ຖ້າຜິດພາດ ຄັ້ງໜ້າດຶງຕໍ່ຈາກບ່ອນເກົ່າ)
      await prisma.$executeRaw`
        insert into hrm_vehicle_fuel_sync (imei, refuel_synced_to, note, last_error, updated_at)
        values (${imei}, ${new Date(cursor).toISOString()}::timestamptz, ${note}, ${err}, now())
        on conflict (imei) do update set
          refuel_synced_to = excluded.refuel_synced_to,
          note = case when ${err}::text is null and ${noteKnown} then excluded.note else hrm_vehicle_fuel_sync.note end,
          last_error = excluded.last_error, updated_at = now()`;
      events += vehicleEvents;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 3) }, worker));
  return { vehicles: vehicles.length, events };
}

/**
 * ລາຍງານນ້ຳມັນ ຂອງ trip (ລົດ 1 ຄັນ, ຊ່ວງ from..to instant) ຈາກ cache — ບໍ່ເອີ້ນ Lao GPS
 * ໃຊ້ໄປ/ໄລຍະ = ຜົນບວກແຖວລາຍວັນ ຂອງວັນທີ່ trip ຄາບກ່ຽວ (ວັນລາວ) · ເຕີມ = ເຫດການໃນຊ່ວງ
 */
export type TripFuelReport = Omit<import("@/lib/fuel-events").RefuelReport, "events"> & { events: RefuelRow[] };
export async function tripFuelFromCache(imei: string, from: Date, to: Date): Promise<TripFuelReport> {
  const toC = new Date(Math.min(to.getTime(), Date.now()));
  const [daily, events, states] = await Promise.all([
    fuelDailyRows(day(from), day(toC), [imei]),
    refuelEventsBetween(from, toC, [imei]),
    fuelSyncStates(),
  ]);
  const agg = aggregateFuelDaily(daily)[0];
  const method = agg?.fuel_method ?? null;
  const st = states.get(imei);
  return {
    imei,
    method,
    tankLitre: agg?.tank_litre ?? null,
    from: from.toISOString(),
    to: toC.toISOString(),
    usedLitre: agg ? (method === "sensor" ? agg.fuel_used_litre_daily_sum : agg.fuel_used_litre) : null,
    distanceKm: agg?.distance_km ?? null,
    startPercent: null,
    endPercent: null,
    events, // RefuelRow ⊃ RefuelEvent — UI ໃຊ້ confidence/station/confirm ນຳ
    refuelLitre: events.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED").reduce((s, e) => s + e.litre, 0),
    note:
      st?.note ??
      (!agg ? "ຍັງບໍ່ມີຂໍ້ມູນ cache ຂອງລົດຄັນນີ້ໃນຊ່ວງ trip (sync ທຸກຊົ່ວໂມງ)" : method === "rate" ? "ລົດຄັນນີ້ບໍ່ມີເຊັນເຊີນ້ຳມັນ (ຄິດຈາກ km) — ບອກການເຕີມບໍ່ໄດ້" : method ? null : "Lao GPS ບໍ່ລາຍງານນ້ຳມັນຂອງລົດຄັນນີ້"),
  };
}

// ── ຈຸດເຕີມ (geofence) + ໃຫ້ຄະແນນເຫດການ ─────────────────────────────────────

export type FuelStation = { id: string; name: string; lat: number; lng: number; radiusM: number; kind: "COMPANY" | "PUBLIC"; active: boolean; events30d: number };

export async function fuelStations(): Promise<FuelStation[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select s.id::text id, s.name, s.lat, s.lng, s.radius_m, s.kind, s.active,
           (select count(*)::int from hrm_vehicle_refuel_event e where e.station_id = s.id and e.event_time > now() - interval '30 days') events30d
      from hrm_fuel_station s order by s.kind, s.name`;
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), lat: Number(r.lat), lng: Number(r.lng), radiusM: n(r.radius_m), kind: r.kind as "COMPANY" | "PUBLIC", active: r.active === true, events30d: n(r.events30d) }));
}

export async function upsertFuelStation(input: { id?: string; name: string; lat: number; lng: number; radiusM: number; kind: "COMPANY" | "PUBLIC"; active: boolean; by: string }): Promise<void> {
  if (input.id) {
    await prisma.$executeRaw`update hrm_fuel_station set name=${input.name}, lat=${input.lat}, lng=${input.lng}, radius_m=${input.radiusM}, kind=${input.kind}, active=${input.active}, updated_at=now() where id=${BigInt(input.id)}`;
  } else {
    await prisma.$executeRaw`insert into hrm_fuel_station (name, lat, lng, radius_m, kind, active, created_by) values (${input.name}, ${input.lat}, ${input.lng}, ${input.radiusM}, ${input.kind}, ${input.active}, ${input.by})`;
  }
}

const distanceM = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = dLng * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return R * Math.sqrt(dLat * dLat + x * x);
};

/**
 * ສະເໜີຈຸດເຕີມໃໝ່ ຈາກ cluster ຂອງເຫດການ REFUEL 30 ວັນ ທີ່ຍັງບໍ່ຢູ່ໃນຈຸດໃດ (≥ minEvents ຄັ້ງ ໃນ 150 m)
 * ຄືນຈຳນວນທີ່ສ້າງ — ຊື່ຕັ້ງຈາກທີ່ຢູ່ GPS ໃຫ້ HR ແກ້ພາຍຫຼັງ
 */
export async function suggestStationsFromEvents(by: string, minEvents = 3): Promise<number> {
  const stations = await fuelStations();
  const rows = await prisma.$queryRaw<{ lat: number; lng: number; address: string | null }[]>`
    select lat, lng, address from hrm_vehicle_refuel_event
     where kind = 'REFUEL' and lat is not null and lng is not null and station_id is null
       and event_time > now() - interval '30 days'`;
  const free = rows.filter((r) => !stations.some((s) => s.active && distanceM(r.lat, r.lng, s.lat, s.lng) <= s.radiusM));
  const used = new Set<number>();
  let created = 0;
  for (let i = 0; i < free.length; i++) {
    if (used.has(i)) continue;
    const members = free.map((r, j) => ({ r, j })).filter(({ r, j }) => !used.has(j) && distanceM(free[i].lat, free[i].lng, r.lat, r.lng) <= 150);
    if (members.length < minEvents) continue;
    members.forEach(({ j }) => used.add(j));
    const lat = members.reduce((s, m) => s + m.r.lat, 0) / members.length;
    const lng = members.reduce((s, m) => s + m.r.lng, 0) / members.length;
    const addr = members.find((m) => m.r.address)?.r.address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    await upsertFuelStation({ name: `ຈຸດເຕີມ (ສະເໜີ) ${addr}`.slice(0, 120), lat, lng, radiusM: 150, kind: members.length >= 6 ? "COMPANY" : "PUBLIC", active: true, by });
    created++;
  }
  return created;
}

/**
 * ໃຫ້ຄະແນນເຫດການ 30 ວັນ (ຄິດຄືນທຸກຮອບ — ບິນອາດມາທີຫຼັງ, ຈຸດເຕີມອາດເພີ່ມ):
 *   station  ຢູ່ໃນ geofence ຈຸດເຕີມທີ່ active
 *   receipt  ມີບິນນ້ຳມັນ — SALE: hrm_sale_trip_expense ຂອງ trip ທີ່ໃຊ້ລົດຄັນນີ້ ±45 ນາທີ ·
 *            TMS: odg_tms_fuel_log ຈັບຄູ່ດ້ວຍເລກທະບຽນ ±1 ວັນ (ຕາຕະລາງນັ້ນມີແຕ່ວັນທີ)
 *   litreOk  ລິດ ≤ ບ່ອນວ່າງໃນຖັງ + 5   rateOk ≤ 60 L/ນາທີ   sizeOk ≥ 8 L
 * confidence: ຄົນຂັບ/ຜູ້ຈັດການ ບໍ່ແມ່ນ → REJECTED · ຢືນຢັນ ຫຼື ມີບິນ → CONFIRMED · (ຢູ່ຈຸດເຕີມ ຫຼື ≥ 10 L) + ຜ່ານກວດ → LIKELY · ອື່ນໆ (ນ້ອຍ + ນອກຈຸດເຕີມ) → CHECK
 * DROP ໃຫ້ CHECK ສະເໝີ (ຕ້ອງໃຫ້ຄົນເບິ່ງ)
 */
export async function scoreRefuelEvents(days = 30): Promise<number> {
  const stations = (await fuelStations()).filter((s) => s.active);
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select e.id::text id, e.imei, e.kind, e.lat, e.lng, e.litre, e.before_pct, e.stop_minutes, e.confirm_status,
           to_char(e.event_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') "time",
           (select tank_litre from hrm_vehicle_fuel_daily d where d.imei = e.imei and d.tank_litre is not null order by d.day desc limit 1) tank,
           (select x.id from hrm_sale_trip_expense x
              join hrm_vehicle_trip t on t.id = x.trip_id
              join public.app_car_vehicles v on v.id::text = t.vehicle_id and trim(v.gps_imei) = e.imei
             where x.type in ('ນ້ຳມັນ','FUEL')
               and (x.incurred_at at time zone 'Asia/Bangkok') between e.event_time - interval '45 minutes' and e.event_time + interval '45 minutes'
             order by abs(extract(epoch from (x.incurred_at at time zone 'Asia/Bangkok') - e.event_time)) limit 1) receipt_id,
           -- ບິນຝັ່ງຂົນສົ່ງ (TMS) ມີແຕ່ວັນທີ ບໍ່ມີເວລາ → ຍອມ ±1 ວັນ ແລະ ຈັບຄູ່ດ້ວຍເລກທະບຽນ
           (select 'tms:' || f.id
              from odg_tms_fuel_log f
              join public.app_car_vehicles v on trim(v.gps_imei) = e.imei
             where (regexp_replace(lower(coalesce(f.car,'')), '[[:space:]._-]+', '', 'g')
                      = regexp_replace(lower(coalesce(v.plate_no,'')), '[[:space:]._-]+', '', 'g')
                    or (length(regexp_replace(coalesce(f.car,''), '[^0-9]', '', 'g')) >= 4
                        and regexp_replace(coalesce(f.car,''), '[^0-9]', '', 'g')
                              = regexp_replace(coalesce(v.plate_no,''), '[^0-9]', '', 'g')))
               and f.fuel_date between (e.event_time at time zone 'Asia/Vientiane')::date - 1
                                   and (e.event_time at time zone 'Asia/Vientiane')::date + 1
             order by abs(f.fuel_date - (e.event_time at time zone 'Asia/Vientiane')::date), f.id
             limit 1) tms_receipt_id
      from hrm_vehicle_refuel_event e
     where e.event_time > now() - (${days}::int * interval '1 day')`;
  let updated = 0;
  for (const r of rows) {
    const lat = nn(r.lat);
    const lng = nn(r.lng);
    const st = lat != null && lng != null ? stations.find((s) => distanceM(lat, lng, s.lat, s.lng) <= s.radiusM) ?? null : null;
    const litre = n(r.litre);
    const tank = nn(r.tank);
    const before = n(r.before_pct);
    const mins = Math.max(1, n(r.stop_minutes));
    const checks: RefuelChecks = {
      station: !!st,
      receipt: r.receipt_id != null || r.tms_receipt_id != null,
      litreOk: tank == null || litre <= (tank * (100 - before)) / 100 + 5,
      rateOk: litre / mins <= 60,
      sizeOk: litre >= 8,
    };
    const confirm = r.confirm_status as string | null;
    let confidence: RefuelRow["confidence"];
    if (confirm === "REJECTED") confidence = "REJECTED";
    else if (r.kind === "DROP") confidence = "CHECK";
    else if (confirm === "CONFIRMED" || checks.receipt) confidence = "CONFIRMED";
    // ຢູ່ຈຸດເຕີມ ຫຼື ≥ 10 L (ຜ່ານເກນ 10% ຂະນະຈອດແລ້ວ ເຊັນເຊີບໍ່ແກວ່ງຂະໜາດນັ້ນ) + ຜ່ານກວດຄວາມສົມເຫດ → ໜ້າຈະແມ່ນ
    else if ((checks.station || litre >= 10) && checks.litreOk && checks.rateOk && checks.sizeOk) confidence = "LIKELY";
    else confidence = "CHECK";
    await prisma.$executeRaw`
      update hrm_vehicle_refuel_event
         set station_id = ${st ? BigInt(st.id) : null},
             receipt_expense_id = ${(r.receipt_id as string | null) ?? (r.tms_receipt_id as string | null) ?? null},
             checks = ${JSON.stringify(checks)}::jsonb, confidence = ${confidence}
       where id = ${BigInt(String(r.id))}`;
    updated++;
  }
  return updated;
}

/** ຊ່ວງວັນທີ່ cache ມີແທ້ (ໄວ້ບອກວ່າມາດຕະຖານຄິດຈາກຂໍ້ມູນຍາວປານໃດ) */
export async function fuelCacheCoverage(): Promise<{ from: string; to: string; days: number } | null> {
  const rows = await prisma.$queryRaw<{ mn: string | null; mx: string | null; d: number }[]>`
    select min(day)::text mn, max(day)::text mx, count(distinct day)::int d from hrm_vehicle_fuel_daily`;
  const r = rows[0];
  if (!r?.mn || !r.mx) return null;
  return { from: r.mn, to: r.mx, days: Number(r.d) };
}
