import "server-only";
import { getHistory, laoGpsConfigured, type LaoGpsTrackPoint } from "@/lib/laogps";

/**
 * ເຫດການເຕີມນ້ຳມັນ ⛽ ຈາກເຊັນເຊີນ້ຳມັນ (Lao GPS Tracker)
 * (ສຳເນົາ logic ຈາກ SALE — ຝັ່ງ SALE ບໍ່ວິເຄາະເອງແລ້ວ ອ່ານຜົນຈາກ DB ທີ່ HRM cron ຂຽນ)
 *
 * ໃຊ້ໄດ້ສະເພາະລົດທີ່ fuel_capability.method = "sensor" (ຄ່າ % ມາຈາກເຊັນເຊີໃນຖັງ).
 * ລົດ method = "rate" ຄ່າ % ເປັນຄ່າຄາດຄະເນຈາກ km — ເຫັນ "ກະໂດດ" ຕອນແລ່ນ ບໍ່ແມ່ນການເຕີມ → ບໍ່ວິເຄາະ.
 *
 * ຫຼັກການ: **ການເຕີມຕ້ອງເກີດຕອນລົດຈອດ** (ຢູ່ປໍ້າ) — ຈຶ່ງຫາ "ການຈອດ" ກ່ອນ ແລ້ວທຽບລະດັບຖັງ ກ່ອນ/ຫຼັງ ຈອດ
 *   1. ການຈອດ = ຈຸດຕິດກັນທີ່ speed ≤ 3 km/h ດົນ ≥ 3 ນາທີ (ຢຸດໄຟແດງ/ລົດຕິດ ບໍ່ນັບ)
 *   2. ນ້ຳມັນຕ້ອງ "ເພີ່ມຂຶ້ນລະຫວ່າງຈອດ": median ຕົ້ນການຈອດ (1 ນາທີ/25% ທຳອິດ) vs ທ້າຍການຈອດ (1 ນາທີ/25% ທ້າຍ) ≥ +8%
 *      — ທັງສອງຄ່າອ່ານຕອນລົດຈອດຢູ່ (ຄ່ານິ້ງ ບໍ່ສະບັດ) ຈຶ່ງໃຊ້ threshold ຕ່ຳໄດ້ (≈ 4–5 L ຖັງ 65–80 L)
 *   3. ຢືນຢັນຫຼັງອອກລົດ 10 ນາທີ: ລະດັບຍັງສູງກວ່າກ່ອນເຕີມ (ກັນເຊັນເຊີແກວ່ງຊົ່ວຄາວ)
 *   4. ກົງກັນຂ້າມ (ຫຼຸດ ≥ 10% ຂະນະຈອດ ແລະ ຍັງຕ່ຳຫຼັງອອກ) = DROP ສົງໄສຖືກດູດ
 *   ຄວາມໝັ້ນໃຈ (fuel-cache.ts scoreRefuelEvents): ຢູ່ຈຸດເຕີມທີ່ຮູ້ຈັກ · ມີບິນນ້ຳມັນໃນ ±45 ນາທີ · ລິດສົມເຫດ (≤ ບ່ອນວ່າງໃນຖັງ, ≤ 60 L/ນາທີ) · ຄົນຂັບຢືນຢັນ
 *   ເຫດການບອກ ເວລາເລີ່ມ/ເລີກຈອດ · ຈອດດົນເທົ່າໃດ · ບ່ອນຈອດ · %ກ່ອນ→ຫຼັງ · ≈ລິດ
 * ຄວາມລະອຽດ ≈ ±3–4 L — ບອກ "ເຕີມເມື່ອໃດ/ບ່ອນໃດ/ປະມານເທົ່າໃດ" ບໍ່ເໝາະ audit ຫາລິດ.
 */
export type RefuelEvent = {
  /** REFUEL = ເຕີມ (ຖັງຂຶ້ນ) · DROP = ນ້ຳມັນຫຼຸດຂະນະຈອດ (ສົງໄສຖືກດູດ) — litre ເປັນຂະໜາດ (ບວກ) ທັງສອງ */
  kind: "REFUEL" | "DROP";
  /** ນາທີທີ່ເຕີມ/ຫຼຸດ (ຈຸດທີ່ລະດັບຂ້າມເຄິ່ງກາງ ກ່ອນ→ຫຼັງ) */
  time: string;
  beforePercent: number;
  afterPercent: number;
  litre: number;
  lat: number | null;
  lng: number | null;
  address: string | null;
  /** ການຈອດທີ່ເຕີມ — ເລີ່ມ/ເລີກ (ISO) ແລະ ນາທີ */
  stopStart: string;
  stopEnd: string;
  stopMinutes: number;
};

export type RefuelReport = {
  imei: string;
  method: "sensor" | "rate" | null;
  tankLitre: number | null;
  from: string;
  to: string;
  /** ຕົວເລກຈາກ Lao GPS (fuel.used_litre) — ຖືກຕ້ອງທັງ sensor ແລະ rate */
  usedLitre: number | null;
  distanceKm: number | null;
  startPercent: number | null;
  endPercent: number | null;
  events: RefuelEvent[];
  refuelLitre: number;
  /** ເຫດຜົນທີ່ບໍ່ມີເຫດການ (ບໍ່ມີ sensor / ເຊັນເຊີເພ / error) */
  note: string | null;
};

const median = (a: number[]): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** median ຝັ່ງຕ່ຳ (ຈຳນວນຄູ່ ເອົາຕົວຕ່ຳ) */
const lowerMedian = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
};
/** median ຝັ່ງສູງ (ຈຳນວນຄູ່ ເອົາຕົວສູງ) */
const upperMedian = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.ceil((s.length - 1) / 2)];
};

const STOP_SPEED = 3; // km/h
const STOP_MIN_MS = 90_000; // ຈອດຢ່າງໜ້ອຍ 90 ວິ — ເຕີມທີ່ປໍ້າຈິງ ວັດໄດ້ 2 ນາທີ (ກຜ-8432 13/08: 3 ຈຸດ 19→82%)
const STOP_RADIUS_M = 300; // ຈຸດຫ່າງກັນບໍ່ເກີນນີ້ = ບ່ອນດຽວກັນ (GPS ແກວ່ງຕອນຈອດ)
const GAP_MS = 90_000; // ອຸປະກອນຫຼັບຕອນດັບເຄື່ອງ → ຈຸດຫ່າງກັນ ≥ 90 ວິ ບ່ອນດຽວກັນ = ຈອດ
const AFTER_MS = 10 * 60_000; // ອ່ານຫຼັງອອກ
const EDGE_MS = 60_000; // ຕົ້ນ/ທ້າຍຂອງການຈອດ ທີ່ນັບເຂົ້າ ກ່ອນ/ຫຼັງ
const MIN_JUMP = 10; // % (≈ 7–8 L ຖັງ 65–80 L) — ວັດຈິງ: ເຕີມແທ້ ≥ +16 L, ເຊັນເຊີ "ຕົກຕະກອນ" ຫຼັງແລ່ນ +6–8% (≈5 L) ບໍ່ແມ່ນການເຕີມ (ກບ-6578 12/08 24→31%)
const MIN_SAMPLES = 3;
const MERGE_MS = 30 * 60_000; // ຈອດ 2 ຄັ້ງຫ່າງກັນ < 30 ນາທີ (ຍ້າຍຈາກຫົວຈ່າຍໄປຈອດ) = ເຕີມຄັ້ງດຽວ

type Pt = LaoGpsTrackPoint & { t: number };

function distM(a: Pt, b: Pt): number {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return 0;
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = dLng * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  return R * Math.sqrt(dLat * dLat + x * x);
}

/**
 * ຊ່ວງຈອດ — ຄູ່ຈຸດຕິດກັນ "ຢູ່ກັບທີ່" ຄື ຫ່າງກັນ < 300 m ແລະ (ທັງສອງ speed ≤ 3 ຫຼື ຫ່າງເວລາ ≥ 90 ວິ)
 * ໂຮມຄູ່ຕິດກັນເປັນຊ່ວງ · ນັບເປັນຈອດເມື່ອດົນ ≥ 90 ວິ — ຄືນ index ຕົ້ນ/ທ້າຍ ໃນ pts
 */
function findStops(pts: Pt[]): { i0: number; i1: number }[] {
  const stops: { i0: number; i1: number }[] = [];
  let i0 = -1;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const still = distM(a, b) < STOP_RADIUS_M && (((a.speed_kmh ?? 0) <= STOP_SPEED && (b.speed_kmh ?? 0) <= STOP_SPEED) || b.t - a.t >= GAP_MS);
    if (still && i0 < 0) i0 = i;
    if (!still && i0 >= 0) {
      if (pts[i].t - pts[i0].t >= STOP_MIN_MS) stops.push({ i0, i1: i });
      i0 = -1;
    }
  }
  if (i0 >= 0 && pts[pts.length - 1].t - pts[i0].t >= STOP_MIN_MS) stops.push({ i0, i1: pts.length - 1 });
  return stops;
}

/** ຫາເຫດການເຕີມ ຈາກຈຸດ track (ຕ້ອງເປັນລົດ sensor · ສົ່ງທຸກຈຸດ ບໍ່ສະເພາະທີ່ມີ fuel) — ສະເພາະຕອນຈອດ */
export function detectRefuels(points: LaoGpsTrackPoint[], tankLitre: number | null): RefuelEvent[] {
  const pts: Pt[] = points
    .map((p) => ({ ...p, t: +new Date(p.time) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  const fuelOf = (a: number, b: number, lo: number, hi: number): number[] => {
    // ຄ່າ % ຂອງຈຸດທີ່ index ∈ [a,b] ແລະ ເວລາ ∈ [lo,hi]
    const out: number[] = [];
    for (let i = Math.max(0, a); i <= Math.min(pts.length - 1, b); i++) {
      const p = pts[i];
      if (p.fuel_percent != null && p.t >= lo && p.t <= hi) out.push(p.fuel_percent);
    }
    return out;
  };
  type Raw = RefuelEvent & { t0: number; t1: number };
  const raw: Raw[] = [];
  for (const { i0, i1 } of findStops(pts)) {
    const tStart = pts[i0].t;
    const tEnd = pts[i1].t;
    // ✅ ເງື່ອນໄຂ: ລົດຈອດ ແລະ ນ້ຳມັນເພີ່ມຂຶ້ນ "ລະຫວ່າງຈອດ" — ທຽບຄ່າຕົ້ນການຈອດ vs ທ້າຍການຈອດ (ທັງສອງອ່ານຕອນຈອດຢູ່)
    const inStop: Pt[] = [];
    for (let i = i0; i <= i1; i++) if (pts[i].fuel_percent != null) inStop.push(pts[i]);
    if (inStop.length < 2) continue;
    const edge = Math.max(EDGE_MS, (tEnd - tStart) * 0.25); // ຕົ້ນ/ທ້າຍ = 1 ນາທີ ຫຼື 25% ຂອງການຈອດ
    const head = inStop.filter((p) => p.t <= tStart + edge).map((p) => p.fuel_percent as number);
    const tail = inStop.filter((p) => p.t >= tEnd - edge).map((p) => p.fuel_percent as number);
    if (!head.length || !tail.length) continue;
    // ຕົ້ນການຈອດ ເອົາຄ່າຕ່ຳ (ຍັງບໍ່ທັນເຕີມ) · ທ້າຍການຈອດ ເອົາຄ່າສູງ (ເຕີມແລ້ວ) — ຈອດສັ້ນ 2–3 ຈຸດ ຈຶ່ງບໍ່ຫຼຸດຄ່າ
    // ເຕີມ: ຕົ້ນເອົາຄ່າຕ່ຳ ທ້າຍເອົາ median · ຫຼຸດ (DROP): ຕົ້ນ median ທ້າຍຄ່າສູງ (ກົງກັນຂ້າມ)
    const bmUp = lowerMedian(head);
    const amUp = median(tail)!;
    const bmDn = median(head)!;
    const amDn = upperMedian(tail);
    const kind: RefuelEvent["kind"] | null = amUp - bmUp >= MIN_JUMP ? "REFUEL" : bmDn - amDn >= MIN_JUMP ? "DROP" : null;
    if (!kind) continue;
    const bm = kind === "REFUEL" ? bmUp : bmDn;
    const am = kind === "REFUEL" ? amUp : amDn;
    // ຢືນຢັນຫຼັງອອກລົດ (10 ນາທີ, ≥ 3 ຄ່າ): ລະດັບຕ້ອງຍັງຢູ່ຝັ່ງທີ່ປ່ຽນ — ກັນເຊັນເຊີແກວ່ງຊົ່ວຄາວຕອນຈອດ
    let b = i1;
    while (b < pts.length - 1 && pts[b + 1].t <= tEnd + AFTER_MS) b++;
    const after = fuelOf(i1 + 1, b, tEnd, tEnd + AFTER_MS);
    let amFinal = am;
    if (after.length >= MIN_SAMPLES) {
      const m = median(after)!;
      if (kind === "REFUEL" ? m < bm + MIN_JUMP * 0.7 : m > bm - MIN_JUMP * 0.7) continue;
      // ລະດັບສຸດທ້າຍ = ຄ່າຫຼັງອອກລົດ ຖ້າສູງກວ່າ (ເຊັນເຊີຍັງໄຕ່ຂຶ້ນຢູ່ຕອນອອກຈາກປໍ້າ — ກບ-3646: ທ້າຍຈອດ 71% ແຕ່ຄົງທີ່ 77–78%)
      amFinal = kind === "REFUEL" ? Math.max(am, m) : Math.min(am, m);
    }
    // ເວລາເຕີມ/ຫຼຸດ = ຈຸດທຳອິດໃນການຈອດທີ່ລະດັບຂ້າມເຄິ່ງກາງ ກ່ອນ→ຫຼັງ (ຈອດຄ້າງຄືນ 900 ນາທີ ກໍບອກນາທີໄດ້)
    let at = i0;
    for (let i = i0; i <= i1; i++) {
      const f = pts[i].fuel_percent;
      if (f != null && (kind === "REFUEL" ? f >= (bm + am) / 2 : f <= (bm + am) / 2)) { at = i; break; }
    }
    raw.push({
      kind,
      time: pts[at].time,
      beforePercent: bm,
      afterPercent: amFinal,
      litre: 0,
      lat: pts[at].latitude ?? pts[i0].latitude,
      lng: pts[at].longitude ?? pts[i0].longitude,
      address: pts[at].address ?? pts[i0].address,
      stopStart: pts[i0].time,
      stopEnd: pts[i1].time,
      stopMinutes: Math.round((tEnd - tStart) / 60_000),
      t0: tStart,
      t1: tEnd,
    });
  }
  // ໂຮມການຈອດຕິດກັນ (< 30 ນາທີ) — ຫົວຈ່າຍ → ຍ້າຍໄປຈອດ ນັບເປັນເຕີມຄັ້ງດຽວ: ກ່ອນ = ຂອງຄັ້ງທຳອິດ · ຫຼັງ = ສູງສຸດ
  const merged: Raw[] = [];
  for (const e of raw) {
    const last = merged[merged.length - 1];
    if (last && last.kind === e.kind && e.t0 - last.t1 < MERGE_MS) {
      last.afterPercent = e.kind === "REFUEL" ? Math.max(last.afterPercent, e.afterPercent) : Math.min(last.afterPercent, e.afterPercent);
      last.stopEnd = e.stopEnd;
      last.t1 = e.t1;
      last.stopMinutes = Math.round((last.t1 - last.t0) / 60_000);
      continue;
    }
    merged.push({ ...e });
  }
  return merged.map(({ t0: _a, t1: _b, ...e }) => ({ // eslint-disable-line @typescript-eslint/no-unused-vars
    ...e,
    litre: tankLitre ? Math.round((Math.abs(e.afterPercent - e.beforePercent) / 100) * tankLitre) : 0,
  }));
}

// cache ໃນ process — history ໜັກ ~5–20k ຈຸດ/ຄັນ
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: RefuelReport }>();

/**
 * ລາຍງານເຕີມນ້ຳມັນ ຂອງລົດ 1 ຄັນ (imei) ໃນຊ່ວງ from..to.
 * method/tankLitre ເອົາຈາກ fuel_capability ຂອງລົດ (listVehicles / getVehicle) — ຜູ້ເອີ້ນສົ່ງມາ ບໍ່ໃຫ້ຂໍຊ້ຳ.
 * ຄືນ null ຖ້າ GPS ບໍ່ໄດ້ຕັ້ງ ຫຼື ຊ່ວງບໍ່ຖືກ. ຄິດຈຸດ track ສະເພາະ sensor.
 */
export async function refuelReport(
  imei: string,
  cap: { method: "sensor" | "rate" | null; tankLitre: number | null },
  from: Date,
  to: Date,
): Promise<RefuelReport | null> {
  if (!laoGpsConfigured()) return null;
  const toR = new Date(Math.floor(Math.min(to.getTime(), Date.now()) / TTL_MS) * TTL_MS);
  if (!(toR > from)) return null;
  const key = `${imei}|${from.toISOString()}|${toR.toISOString()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const base: RefuelReport = {
    imei, method: cap.method, tankLitre: cap.tankLitre,
    from: from.toISOString(), to: toR.toISOString(),
    usedLitre: null, distanceKm: null, startPercent: null, endPercent: null,
    events: [], refuelLitre: 0, note: null,
  };
  try {
    const { data } = await getHistory(imei, { from: from.toISOString(), to: toR.toISOString(), includePoints: cap.method === "sensor", limit: 20000 });
    base.usedLitre = data.fuel?.used_litre ?? null;
    base.distanceKm = data.summary?.distance_km ?? null;
    if (cap.method === "sensor") {
      const pts = (data.points ?? []).filter((p) => p.fuel_percent != null);
      base.startPercent = pts[0]?.fuel_percent ?? null;
      base.endPercent = pts[pts.length - 1]?.fuel_percent ?? null;
      base.events = detectRefuels(data.points ?? [], cap.tankLitre); // ສົ່ງທຸກຈຸດ — ຕ້ອງໃຊ້ speed ຫາການຈອດ
      base.refuelLitre = base.events.reduce((s, e) => s + e.litre, 0);
      if (!pts.length) base.note = "ບໍ່ມີຂໍ້ມູນເຊັນເຊີໃນຊ່ວງນີ້";
      else {
        // ເຊັນເຊີຄ້າງ: ແລ່ນ > 100 km ແຕ່ຄ່າ % ແກວ່ງບໍ່ເຖິງ 3 (ພົບ ລຣ-9977 ອ່ານ 3–5% ຕະຫຼອດ 974 km)
        const vals = pts.map((p) => p.fuel_percent as number);
        if ((base.distanceKm ?? 0) > 100 && Math.max(...vals) - Math.min(...vals) < 3) {
          base.note = `ເຊັນເຊີອາດເພ — ຄ່າຄ້າງ ~${median(vals)}% ຕະຫຼອດ ${Math.round(base.distanceKm ?? 0)} km · ແຈ້ງ Lao GPS ກວດ`;
        }
      }
    } else if (cap.method === "rate") {
      base.note = "ລົດຄັນນີ້ບໍ່ມີເຊັນເຊີນ້ຳມັນ (ຄິດຈາກ km) — ບອກການເຕີມບໍ່ໄດ້";
    } else {
      base.note = "Lao GPS ບໍ່ລາຍງານນ້ຳມັນຂອງລົດຄັນນີ້";
    }
  } catch (e) {
    base.note = e instanceof Error ? e.message : "ເອີ້ນ Lao GPS ບໍ່ໄດ້";
  }
  cache.set(key, { at: Date.now(), value: base });
  return base;
}

/**
 * timestamp/date ໃນ DB ບໍ່ມີ tz ແລະ ເກັບເປັນເວລາລາວ (ຝັ່ງ SALE ຂຽນ now() ຂອງ Postgres tz Asia/Bangkok)
 * Prisma ອ່ານມາເປັນ Date ທີ່ຕົວເລກ UTC = ຕົວເລກໃນ DB → ລົບ 7 ຊມ ໄດ້ instant ຈິງ
 */
export function laoNaiveToUtc(d: Date): Date {
  return new Date(d.getTime() - 7 * 3600_000);
}
