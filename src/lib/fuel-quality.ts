import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * 🧪 ຄຸນນະພາບຕົວເລກນ້ຳມັນ — ແກ້ຄ່າທີ່ Lao GPS ຄິດເພື້ອນ ກ່ອນເອົາໄປສະແດງ/ລວມ
 *
 * ບັນຫາທີ່ພົບຈິງ (2026-08): ບາງຄັນ Lao GPS ຄິດ "ລິດທີ່ໃຊ້" ຈາກ % ຖັງທີ່ແກວ່ງ
 *   ກບ-2608 18 ກມ → ອ້າງວ່າໃຊ້ 146 ລິດ (225% ຂອງຖັງ ໃນມື້ດຽວ) · ລວມ 60 ວັນ ໄດ້ 0.96 ກມ/ລິດ
 *   ກົງກັນຂ້າມ ລຣ-9977 ເຊັນເຊີຄ້າງ → 51 ກມ/ລິດ (ໃຊ້ນ້ຳມັນໜ້ອຍເກີນຈິງ)
 *
 * ວິທີແກ້: ຖ້າຄ່າທີ່ໄດ້ຢູ່ນອກຊ່ວງທີ່ເປັນໄປໄດ້ ({@link SANE_MIN}–{@link SANE_MAX} ກມ/ລິດ)
 * ໃຫ້ປະມານຈາກ **ມາດຕະຖານຂອງຄັນນັ້ນ** ຕາມລຳດັບຄວາມໜ້າເຊື່ອຖື:
 *   1. `bills` — ລິດຈາກບິນຈິງ (TMS/SALE) ÷ ກມ ຈາກ GPS  ← ໜ້າເຊື່ອຖືສຸດ ເພາະເປັນເງິນທີ່ຈ່າຍແທ້
 *   2. `gps`   — ຄ່າ GPS ຂອງຄັນນັ້ນເອງ ຖ້າມັນຢູ່ໃນຊ່ວງທີ່ເປັນໄປໄດ້
 *   3. `fleet` — ຄ່າກາງຂອງ fleet (ຄັນທີ່ 1 ຫຼື 2 ຜ່ານ)
 * ⚠ ມາດຕະຖານທີ່ຫ່າງຈາກຄ່າກາງ fleet ເກີນ 0.4×–2.5× ຖືກຕັດອອກ — ບິນເອງກໍຜິດໄດ້ (ບິນລົງຜິດຄັນ)
 * ແຖວທີ່ຖືກປະມານ ຕ້ອງໝາຍໃຫ້ຜູ້ອ່ານຮູ້ສະເໝີ — ຫ້າມສະແດງເປັນຄ່າວັດຈິງ
 */

export const SANE_MIN = 2;
export const SANE_MAX = 20;
/** ບິນທີ່ຄ່າຢູ່ນອກຊ່ວງນີ້ ຖືວ່າພິມຜິດ (ຄືກັນກັບ fuel-cost.ts) */
const LITRE_MIN = 1;
const LITRE_MAX = 200;
const PRICE_MIN = 5_000;
const PRICE_MAX = 60_000;

export type FuelNormSource = "bills" | "gps" | "fleet";
export type VehicleFuelNorm = { imei: string; kmPerLitre: number; source: FuelNormSource; bills: number };

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const sane = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v) && v >= SANE_MIN && v <= SANE_MAX;

/** ມາດຕະຖານ ກມ/ລິດ ຕໍ່ຄັນ (ຄິດຈາກ `days` ວັນຫຼ້າສຸດ) */
export async function vehicleFuelNorms(days = 90): Promise<{
  norms: Map<string, VehicleFuelNorm>;
  fleetKmPerLitre: number | null;
}> {
  const [gpsRows, billRows] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
      select imei,
             coalesce(sum(distance_km), 0) km,
             coalesce(sum(fuel_used_litre), 0) litre
        from hrm_vehicle_fuel_daily
       where day > current_date - (${days}::int)
       group by 1`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      select imei, sum(bills)::int bills, sum(litre) litre from (
        -- ບິນຝັ່ງຂົນສົ່ງ (TMS) — ຈັບຄູ່ດ້ວຍເລກທະບຽນ
        select trim(v.gps_imei) imei, count(*)::int bills, coalesce(sum(f.liters), 0) litre
          from odg_tms_fuel_log f
          join public.app_car_vehicles v
            on regexp_replace(lower(coalesce(f.car, '')), '[[:space:]._-]+', '', 'g')
                 = regexp_replace(lower(coalesce(v.plate_no, '')), '[[:space:]._-]+', '', 'g')
            or (length(regexp_replace(coalesce(f.car, ''), '[^0-9]', '', 'g')) >= 4
                and regexp_replace(coalesce(f.car, ''), '[^0-9]', '', 'g')
                      = regexp_replace(coalesce(v.plate_no, ''), '[^0-9]', '', 'g'))
         where f.fuel_date > current_date - (${days}::int)
           and f.liters between ${LITRE_MIN} and ${LITRE_MAX}
           and f.amount > 0
           and f.amount / f.liters between ${PRICE_MIN} and ${PRICE_MAX}
           and nullif(trim(v.gps_imei), '') is not null
         group by 1
        union all
        -- ບິນຝັ່ງຂາຍ (SALE) — ຜູກຜ່ານ trip
        select trim(v.gps_imei) imei, count(*)::int bills, coalesce(sum(e.litre), 0) litre
          from hrm_sale_trip_expense e
          join hrm_vehicle_trip t on t.id = e.trip_id
          join public.app_car_vehicles v on v.id::text = t.vehicle_id
         where e.type in ('FUEL', 'ນ້ຳມັນ')
           and e.incurred_at > now() - (${days}::int * interval '1 day')
           and e.litre between ${LITRE_MIN} and ${LITRE_MAX}
           and nullif(trim(v.gps_imei), '') is not null
         group by 1
      ) b group by 1`,
  ]);

  const km = new Map<string, number>();
  const gpsLitre = new Map<string, number>();
  for (const r of gpsRows) {
    const imei = String(r.imei).trim();
    km.set(imei, n(r.km));
    gpsLitre.set(imei, n(r.litre));
  }

  const candidates = new Map<string, VehicleFuelNorm>();
  for (const r of billRows) {
    const imei = String(r.imei).trim();
    const litre = n(r.litre);
    const bills = n(r.bills);
    const distance = km.get(imei) ?? 0;
    const value = litre > 0 && distance >= 100 ? distance / litre : null;
    if (bills >= 2 && sane(value)) candidates.set(imei, { imei, kmPerLitre: value, source: "bills", bills });
  }
  for (const [imei, distance] of km) {
    if (candidates.has(imei)) continue;
    const litre = gpsLitre.get(imei) ?? 0;
    const value = litre > 0 && distance >= 100 ? distance / litre : null;
    if (sane(value)) candidates.set(imei, { imei, kmPerLitre: value, source: "gps", bills: 0 });
  }

  // ຮອບ 1: ຄ່າກາງເບື້ອງຕົ້ນ → ຕັດຄ່າທີ່ຫ່າງຈາກໝູ່ຫຼາຍອອກ (ບິນເອງກໍອາດຜິດ ເຊັ່ນ ບິນລົງຜິດຄັນ)
  // ຮອບ 2: ຄິດຄ່າກາງຄືນຈາກອັນທີ່ຮັບ ແລ້ວຈຶ່ງເອົາໄປຕື່ມໃຫ້ຄັນທີ່ຍັງບໍ່ມີ
  const midOf = (list: number[]) => {
    const v = [...list].sort((a, b) => a - b);
    if (!v.length) return null;
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  };
  const rough = midOf([...candidates.values()].map((v) => v.kmPerLitre));
  const norms = new Map<string, VehicleFuelNorm>();
  for (const [imei, c] of candidates) {
    const ok = rough == null || (c.kmPerLitre >= rough * 0.4 && c.kmPerLitre <= rough * 2.5);
    if (ok) norms.set(imei, c);
  }
  const fleetKmPerLitre = midOf([...norms.values()].map((v) => v.kmPerLitre)) ?? rough;

  // ຄັນທີ່ຍັງບໍ່ມີມາດຕະຖານ (ຄ່າຕົນເອງເພື້ອນ ແລະ ບໍ່ມີບິນ) → ໃຊ້ຄ່າກາງ fleet
  if (fleetKmPerLitre != null) {
    for (const imei of km.keys()) {
      if (!norms.has(imei)) norms.set(imei, { imei, kmPerLitre: fleetKmPerLitre, source: "fleet", bills: 0 });
    }
  }
  return { norms, fleetKmPerLitre };
}

export type CorrectedFuel = {
  /** ລິດທີ່ຄວນສະແດງ (ຂອງຈິງ ຫຼື ປະມານ) */
  litre: number | null;
  /** true = ປະມານຈາກມາດຕະຖານ ບໍ່ແມ່ນຄ່າວັດ */
  estimated: boolean;
  /** ຄ່າດິບທີ່ Lao GPS ໃຫ້ມາ (ໄວ້ບອກຜູ້ອ່ານວ່າແກ້ຈາກຫຍັງ) */
  reported: number | null;
  norm: VehicleFuelNorm | null;
};

/** ແກ້ຄ່າ 1 ຄັນ: ຖ້າ ກມ/ລິດ ທີ່ໄດ້ ຢູ່ນອກຊ່ວງທີ່ເປັນໄປໄດ້ ໃຫ້ປະມານຈາກມາດຕະຖານແທນ */
export function correctFuel(km: number, reported: number | null, norm: VehicleFuelNorm | null | undefined): CorrectedFuel {
  const use = norm ?? null;
  const estimate = () => (use && km >= 1 ? Math.round((km / use.kmPerLitre) * 100) / 100 : null);

  if (reported == null || reported <= 0) {
    const litre = estimate();
    return { litre, estimated: litre != null, reported, norm: use };
  }
  // ໄລຍະສັ້ນເກີນໄປ ຕັດສິນບໍ່ໄດ້ — ຮັບຄ່າທີ່ໄດ້ມາໄປເລີຍ
  if (km < 5) return { litre: reported, estimated: false, reported, norm: use };

  const implied = km / reported;
  if (sane(implied)) return { litre: reported, estimated: false, reported, norm: use };

  const litre = estimate();
  return litre == null
    ? { litre: reported, estimated: false, reported, norm: use }
    : { litre, estimated: true, reported, norm: use };
}

export const NORM_SOURCE_LABEL: Record<FuelNormSource, string> = {
  bills: "ຈາກບິນຈິງ",
  gps: "ຈາກ GPS ຂອງຄັນນີ້",
  fleet: "ຄ່າກາງຂອງ fleet",
};
