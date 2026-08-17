/**
 * Logic ບໍລິສຸດຂອງ GPS — ວິເຄາະເສັ້ນທາງ, ຊ່ວງວັນທີ ແລະ ການຈັດຮູບແບບ.
 *
 * ແຍກອອກຈາກ `fleet-gps.ts` ໂດຍເຈດຕະນາ: ໄຟລ໌ນີ້ **ບໍ່ import** `server-only`
 * ຫຼື prisma ຈຶ່ງ `npm test` ໂຫຼດໄດ້ (ຕາມແບບ attendance.ts / trip.ts).
 */

export function vehicleLabel(v: { plateNo?: string | null; name?: string | null; imei?: string }): string {
  return v.plateNo || v.name || v.imei || "-";
}

/** ວັນທີມື້ນີ້ຕາມເວລາລາວ (YYYY-MM-DD) — API ຕີຄວາມວັນເປົ່າເປັນ Asia/Vientiane */
export function laoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

/** ວັນທີຍ້ອນຫຼັງ n ວັນຈາກມື້ນີ້ (ເວລາລາວ) */
export function laoDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { from: string; to: string; note: string | null };

/**
 * ອ່ານ/ກວດ from-to ຈາກ query string ແລະ ບີບໃຫ້ຢູ່ໃນຂອບເຂດຂອງ endpoint.
 * ຄືນ `note` ເມື່ອຖືກປັບ ເພື່ອບອກຜູ້ໃຊ້ ແທນທີ່ຈະປັບງຽບໆ.
 */
export function resolveRange(
  fromParam: string | undefined,
  toParam: string | undefined,
  maxDays: number,
  defaultDays = 1,
): DateRange {
  let from = DATE_RE.test(fromParam ?? "") ? fromParam! : laoDaysAgo(defaultDays - 1);
  let to = DATE_RE.test(toParam ?? "") ? toParam! : laoToday();
  let note: string | null = null;

  if (from > to) {
    [from, to] = [to, from];
    note = "ສະຫຼັບວັນທີເລີ່ມ/ສິ້ນສຸດໃຫ້ແລ້ວ";
  }

  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000) + 1;
  if (days > maxDays) {
    from = new Date(Date.parse(`${to}T00:00:00Z`) - (maxDays - 1) * 86400_000)
      .toISOString()
      .slice(0, 10);
    note = `ຊ່ວງສູງສຸດຂອງລາຍງານນີ້ຄື ${maxDays} ວັນ — ປັບວັນເລີ່ມເປັນ ${from}`;
  }
  return { from, to, note };
}

/** ຕົວເລກ 1 ຕຳແໜ່ງທົດນິຍົມ ຫຼື "—" ຖ້າ null (ຢ່າສະແດງ 0 ແທນ null) */
export function num(v: number | null | undefined, digits = 1): string {
  return v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** ຊົ່ວໂມງ → "2 ຊມ 30 ນທ" */
export function hours(v: number | null | undefined): string {
  if (v == null) return "—";
  const total = Math.round(v * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} ຊມ ${m} ນທ` : `${m} ນທ`;
}

// ── ຈຸດຈອດ ─────────────────────────────────────────────────────────────────

export type Stop = {
  seq: number;
  lat: number;
  lng: number;
  /** ISO UTC */
  from: string;
  to: string;
  minutes: number;
  address: string | null;
};

type TrackPointLike = {
  time: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  address: string | null;
};

/** ໄລຍະລະຫວ່າງສອງພິກັດ (ແມັດ) — haversine */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * ຫາຈຸດຈອດຈາກຈຸດເສັ້ນທາງ.
 *
 * ນິຍາມ "ຈອດ" = ຢູ່ໃນລັດສະໝີ `radiusM` ດ້ວຍຄວາມໄວ ≤ `maxSpeedKmh`
 * ຕິດຕໍ່ກັນຢ່າງໜ້ອຍ `minMinutes` ນາທີ.
 *
 * ໃຊ້ລັດສະໝີແທນການເບິ່ງຄວາມໄວຢ່າງດຽວ ເພາະ GPS ແກວ່ງໄດ້ຫຼາຍສິບແມັດ
 * ຕອນຈອດຢູ່ ຈຶ່ງອາດເຫັນເປັນ "ຍ້າຍທີ່" ທັງທີ່ບໍ່ໄດ້ຍ້າຍ.
 */
export function detectStops(
  points: TrackPointLike[],
  opts: { maxSpeedKmh?: number; radiusM?: number; minMinutes?: number } = {},
): Stop[] {
  const maxSpeed = opts.maxSpeedKmh ?? 3;
  const radius = opts.radiusM ?? 80;
  const minMinutes = opts.minMinutes ?? 5;

  const pts = points.filter(
    (p) => p.latitude != null && p.longitude != null && (p.latitude !== 0 || p.longitude !== 0),
  );

  const stops: Stop[] = [];
  let i = 0;
  while (i < pts.length) {
    if ((pts[i].speed_kmh ?? 0) > maxSpeed) {
      i += 1;
      continue;
    }
    const anchor = pts[i];
    let j = i;
    while (
      j + 1 < pts.length &&
      (pts[j + 1].speed_kmh ?? 0) <= maxSpeed &&
      metresBetween(anchor.latitude!, anchor.longitude!, pts[j + 1].latitude!, pts[j + 1].longitude!) <= radius
    ) {
      j += 1;
    }

    const from = Date.parse(pts[i].time);
    const to = Date.parse(pts[j].time);
    const minutes = Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / 60000) : 0;

    if (minutes >= minMinutes) {
      const run = pts.slice(i, j + 1);
      stops.push({
        seq: stops.length + 1,
        lat: run.reduce((s, p) => s + p.latitude!, 0) / run.length,
        lng: run.reduce((s, p) => s + p.longitude!, 0) / run.length,
        from: pts[i].time,
        to: pts[j].time,
        minutes,
        address: run.find((p) => p.address)?.address ?? null,
      });
    }
    i = j + 1;
  }
  return stops;
}

/** ນາທີ → "2 ຊມ 15 ນທ" */
export function minutesLabel(m: number): string {
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h ? `${h} ຊມ ${rest} ນທ` : `${rest} ນທ`;
}

/** ISO UTC → ເວລາລາວ "DD/MM HH:MM" */
export function laoTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString("en-GB", {
    timeZone: "Asia/Vientiane",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── ມາດຕະຖານການກິນນ້ຳມັນ ───────────────────────────────────────────────────

/** ໜຶ່ງວັນທີ່ໃຊ້ຄິດມາດຕະຖານ */
export type FuelDay = { day: string; km: number; litre: number };

export type FuelNorm = {
  /** ຈຳນວນວັນທີ່ໃຊ້ຄິດໄດ້ */
  days: number;
  totalKm: number;
  totalLitre: number;
  /** Σກມ ÷ Σລິດ — ຕົວເລກຫຼັກ (ຖ່ວງນ້ຳໜັກຕາມໄລຍະທາງ) */
  kmPerLitre: number | null;
  /** ມັດທະຍົມຂອງ ກມ/ລິດ ລາຍວັນ — ທົນຕໍ່ວັນທີ່ຜິດປົກກະຕິ */
  median: number | null;
  /** ຊ່ວງກາງ 50% (p25–p75) ບອກຄວາມສະໝ່ຳສະເໝີ */
  p25: number | null;
  p75: number | null;
};

/** ຄ່າຢູ່ຕຳແໜ່ງ q (0-1) ຂອງລາຍການທີ່ຮຽງແລ້ວ */
function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

/**
 * ຄິດມາດຕະຖານ ກມ/ລິດ ຈາກຂໍ້ມູນລາຍວັນ.
 *
 * ຄັດວັນທີ່ເຊື່ອບໍ່ໄດ້ອອກກ່ອນ: ໄລຍະທາງໜ້ອຍກວ່າ `minKm` (ຂີ່ໃນເມືອງສັ້ນໆ
 * ຫຼື GPS ແກວ່ງ) ແລະ ວັນທີ່ບໍ່ມີຄ່ານ້ຳມັນ. ຄືນທັງຄ່າລວມ ແລະ ມັດທະຍົມ
 * ເພາະຄ່າລວມຖືກກະທົບຈາກວັນທີ່ເຕີມນ້ຳມັນຜິດປົກກະຕິໄດ້.
 */
export function fuelNorm(rows: FuelDay[], opts: { minKm?: number } = {}): FuelNorm {
  const minKm = opts.minKm ?? 5;
  const use = rows.filter((r) => r.km >= minKm && r.litre > 0);

  const totalKm = use.reduce((s, r) => s + r.km, 0);
  const totalLitre = use.reduce((s, r) => s + r.litre, 0);
  const each = use.map((r) => r.km / r.litre).sort((a, b) => a - b);

  return {
    days: use.length,
    totalKm,
    totalLitre,
    kmPerLitre: totalLitre > 0 ? totalKm / totalLitre : null,
    median: quantile(each, 0.5),
    p25: quantile(each, 0.25),
    p75: quantile(each, 0.75),
  };
}
