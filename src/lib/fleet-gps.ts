import "server-only";
import { prisma } from "./prisma";
import { getFuel } from "./laogps";
import { fuelNorm, type FuelDay, type FuelNorm } from "./gps-track";
import { fuelDailyRows, type FuelDailyRow } from "./fuel-cache";

/**
 * ຕົວຊ່ວຍລະຫວ່າງ HRM ກັບ Lao GPS Open API.
 *
 * ຈຸດເຊື່ອມຄື IMEI: `app_car_vehicles.gps_imei` — Open API ຮັບ IMEI ເປັນ `{id}`
 * ໄດ້ໂດຍກົງ ຈຶ່ງບໍ່ຕ້ອງເກັບ vehicle_id ຝັ່ງ LaoGPS ໄວ້ອີກຊຸດ.
 */

export type GpsVehicleOption = {
  id: string;
  imei: string;
  plateNo: string | null;
  name: string | null;
};

/** ລົດ HRM ທີ່ຕັ້ງ GPS IMEI ແລ້ວ — ໃຊ້ເປັນຕົວເລືອກໃນໜ້າລາຍງານ */
export async function gpsVehicleOptions(): Promise<GpsVehicleOption[]> {
  const rows = await prisma.carVehicle.findMany({
    where: { gpsImei: { not: null } },
    select: { id: true, gpsImei: true, plateNo: true, name: true },
    orderBy: { plateNo: "asc" },
  });
  return rows
    .filter((r) => r.gpsImei?.trim())
    .map((r) => ({
      id: r.id.toString(),
      imei: r.gpsImei!.trim(),
      plateNo: r.plateNo,
      name: r.name,
    }));
}

/**
 * ວັນທີ່ລົດ **ແລ່ນຈິງ** ໃນເດືອນ (ຈາກ GPS) — ໃຊ້ທຽບກັບແຜນທີ່ຈອງໄວ້.
 * ຄືນ `imei → (ວັນ YYYY-MM-DD → ໄລຍະທາງ ກມ)`
 *
 * ໃຊ້ `/vehicles/{imei}/fuel?daily=true` ເພາະຄືນ `daily[]` ພ້ອມ `distance_km`
 * ຂອງທັງເດືອນໃນ **ຄຳຂໍດຽວຕໍ່ລົດ** (ຖ້າໃຊ້ /history ຈະເປັນ 1 ຄຳຂໍຕໍ່ວັນ).
 *
 * ນັບວ່າ "ແລ່ນ" ເມື່ອໄລຍະທາງເກີນ `minKm` — ກັນ GPS ແກວ່ງຕອນຈອດ
 * ເຮັດໃຫ້ເບິ່ງຄືລົດແລ່ນທັງທີ່ບໍ່ໄດ້ໄປໃສ.
 */
export async function monthlyActualUse(
  imeis: string[],
  monthISO: string,
  opts: { minKm?: number; concurrency?: number } = {},
): Promise<Map<string, Map<string, number>>> {
  const minKm = opts.minKm ?? 1;
  const limit = opts.concurrency ?? 4;

  const [y, m] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${monthISO}-01`;
  const to = `${monthISO}-${String(lastDay).padStart(2, "0")}`;

  const out = new Map<string, Map<string, number>>();
  const queue = [...imeis];

  // ຍິງເປັນຊຸດ — endpoint ນີ້ອ່ານ tracking store ຈຶ່ງບໍ່ຄວນຍິງພ້ອມກັນທັງໝົດ
  async function worker() {
    for (;;) {
      const imei = queue.shift();
      if (!imei) return;
      try {
        const f = await getFuel(imei, { from, to, daily: true });
        const days = new Map<string, number>();
        for (const d of f.daily ?? []) {
          if ((d.distance_km ?? 0) > minKm) days.set(d.day.slice(0, 10), d.distance_km);
        }
        out.set(imei, days);
      } catch {
        // ດຶງຄັນນີ້ບໍ່ໄດ້ → ບໍ່ມີຂໍ້ມູນຈິງ, ໜ້າຍັງສະແດງແຜນໄດ້ຕາມປົກກະຕິ
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
  return out;
}

export type VehicleFuelNorm = FuelNorm & {
  imei: string;
  /** `sensor` = ວັດຈາກເຊັນເຊີຖັງ (ເຊື່ອຖືໄດ້) · `rate` = ຄິດຈາກອັດຕາທີ່ຕັ້ງໄວ້ */
  method: string | null;
  /** ອັດຕາທີ່ຕັ້ງໄວ້ໃນລະບົບ GPS (ມີສະເພາະ rate-model) */
  configuredKmPerLitre: number | null;
};

/**
 * ມາດຕະຖານການກິນນ້ຳມັນຂອງແຕ່ລະຄັນ ຈາກຂໍ້ມູນລາຍວັນໃນ **cache** (`hrm_vehicle_fuel_daily`).
 *
 * ອ່ານ DB ຄຳຂໍດຽວ (ms) — ບໍ່ແຕະ Open API. ຄົນເອີ້ນ API ຄື cron `npm run gps:sync-fuel`
 * (ເມື່ອກ່ອນໜ້ານີ້ດຶງສົດ ລົດ × ເດືອນ ຄຳຂໍ ຈຶ່ງລໍເປັນນາທີ).
 * ວັນທີ່ cache ຍັງບໍ່ມີ ຈະບໍ່ຖືກນັບ — ໃຫ້ backfill ດ້ວຍ `npm run gps:sync-fuel -- --days=90`.
 *
 * ⚠ ເຊື່ອຖືໄດ້ສະເພາະລົດແບບ **`sensor`**. ລົດແບບ `rate` ຄິດນ້ຳມັນຈາກ
 * ອັດຕາທີ່ຕັ້ງໄວ້ຢູ່ແລ້ວ ຈຶ່ງເອົາມາຄິດ ກມ/ລິດ ຄືນເປັນການວົນຊ້ຳ ບໍ່ແມ່ນການວັດ.
 * ຜູ້ເອີ້ນຕ້ອງແຍກສະແດງໃຫ້ຊັດ.
 */
export async function fleetFuelNorms(
  imeis: string[],
  range: { from: string; to: string },
  opts: { minKm?: number } = {},
): Promise<Map<string, VehicleFuelNorm>> {
  const out = new Map<string, VehicleFuelNorm>();
  if (imeis.length === 0) return out;

  const rows = await fuelDailyRows(range.from, range.to, imeis);
  const byImei = new Map<string, FuelDailyRow[]>();
  for (const r of rows) (byImei.get(r.imei) ?? byImei.set(r.imei, []).get(r.imei)!).push(r);

  for (const [imei, list] of byImei) {
    // ວິທີວັດ/ອັດຕາທີ່ຕັ້ງໄວ້ — ເອົາຄ່າຫຼ້າສຸດທີ່ບໍ່ null (fuelDailyRows ຮຽງ day ຂຶ້ນຢູ່ແລ້ວ)
    const latest = [...list].reverse();
    const days: FuelDay[] = list
      .filter((r) => r.fuel_used_litre != null)
      .map((r) => ({ day: r.day, km: r.distance_km, litre: r.fuel_used_litre! }));
    out.set(imei, {
      imei,
      method: latest.find((r) => r.fuel_method)?.fuel_method ?? null,
      configuredKmPerLitre: latest.find((r) => r.km_per_litre != null)?.km_per_litre ?? null,
      ...fuelNorm(days, { minKm: opts.minKm }),
    });
  }
  return out;
}

// Logic ບໍລິສຸດຢູ່ `gps-track.ts` (ບໍ່ມີ server-only ຈຶ່ງ test ໄດ້) — re-export
// ໄວ້ບ່ອນນີ້ ເພື່ອບໍ່ໃຫ້ໜ້າທີ່ import ຢູ່ແລ້ວຕ້ອງແກ້.
export {
  detectStops,
  hours,
  laoDaysAgo,
  laoTime,
  laoToday,
  minutesLabel,
  num,
  resolveRange,
  vehicleLabel,
  type DateRange,
  type Stop,
  type FuelNorm,
} from "./gps-track";
