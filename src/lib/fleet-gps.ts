import "server-only";
import { prisma } from "./prisma";
import { getFuel } from "./laogps";
import { fuelNorm, type FuelDay, type FuelNorm } from "./gps-track";

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
 * ມາດຕະຖານການກິນນ້ຳມັນຂອງແຕ່ລະຄັນ ຈາກຂໍ້ມູນລາຍວັນຫຼາຍເດືອນ.
 *
 * ⚠ ເຊື່ອຖືໄດ້ສະເພາະລົດແບບ **`sensor`**. ລົດແບບ `rate` ຄິດນ້ຳມັນຈາກ
 * ອັດຕາທີ່ຕັ້ງໄວ້ຢູ່ແລ້ວ ຈຶ່ງເອົາມາຄິດ ກມ/ລິດ ຄືນເປັນການວົນຊ້ຳ ບໍ່ແມ່ນການວັດ.
 * ຜູ້ເອີ້ນຕ້ອງແຍກສະແດງໃຫ້ຊັດ.
 *
 * ຄຳຂໍ = ຈຳນວນລົດ × ຈຳນວນເດືອນ (endpoint ຈຳກັດ 31 ວັນ/ຄຳຂໍ).
 */
export async function fleetFuelNorms(
  imeis: string[],
  monthsISO: string[],
  opts: { minKm?: number; concurrency?: number } = {},
): Promise<Map<string, VehicleFuelNorm>> {
  const limit = opts.concurrency ?? 3;
  const out = new Map<string, VehicleFuelNorm>();
  const queue = [...imeis];

  async function worker() {
    for (;;) {
      const imei = queue.shift();
      if (!imei) return;
      const rows: FuelDay[] = [];
      let method: string | null = null;
      let configured: number | null = null;

      for (const m of monthsISO) {
        const [y, mm] = m.split("-").map(Number);
        const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
        try {
          const f = await getFuel(imei, { from: `${m}-01`, to: `${m}-${last}`, daily: true });
          method ??= f.fuel_method;
          configured ??= f.km_per_litre;
          for (const d of f.daily ?? []) {
            if (d.fuel_used_litre != null) {
              rows.push({ day: d.day.slice(0, 10), km: d.distance_km ?? 0, litre: d.fuel_used_litre });
            }
          }
        } catch {
          // ເດືອນນີ້ດຶງບໍ່ໄດ້ → ຄິດຈາກເດືອນທີ່ເຫຼືອ
        }
      }
      out.set(imei, {
        imei,
        method,
        configuredKmPerLitre: configured,
        ...fuelNorm(rows, { minKm: opts.minKm }),
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
  return out;
}

/** ເດືອນຍ້ອນຫຼັງ n ເດືອນ ນັບຈາກເດືອນປັດຈຸບັນ (ເກົ່າ → ໃໝ່) */
export function recentMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
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
