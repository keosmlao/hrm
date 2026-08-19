import "server-only";
import { prisma } from "@/lib/prisma";
import { fuelBillSource, plateDigits, plateKey, type FuelBillSource } from "@/lib/fuel-bills";
import { fuelDailyRows, refuelEventsBetween } from "@/lib/fuel-cache";

/**
 * 💰 ຕົ້ນທຶນຕໍ່ກິໂລແມັດ + ກວດບິນນ້ຳມັນທຽບເຊັນເຊີ (ຕໍ່ລົດ ຕໍ່ຊ່ວງວັນ)
 *
 * ລວມ 4 ແຫຼ່ງ:
 *   GPS         `hrm_vehicle_fuel_daily`      ໄລຍະທາງ + ນ້ຳມັນທີ່ລະບົບຄິດ (cron gps:sync-fuel)
 *   ເຊັນເຊີ      `hrm_vehicle_refuel_event`    ການເຕີມ/ການຫຼຸດ ທີ່ຈັບໄດ້ຈາກ % ຖັງ
 *   ບິນ          TMS `odg_tms_fuel_log` ຫຼື SALE `hrm_sale_trip_expense` (ຕາມພະແນກ — ເບິ່ງ fuel-bills.ts)
 *   ສ້ອມແປງ      TMS `odg_tms_maint_log`       ຄ່າສ້ອມ (ນັບສະເພາະ LAK — ສະກຸນອື່ນລາຍງານແຍກ)
 *
 * ⚠ ສອງກັບດັກທີ່ຈັດການໄວ້ແລ້ວ:
 *   1) TMS ບໍ່ໄດ້ຜູກ vehicle_id — ຈັບຄູ່ດ້ວຍປ້າຍທີ່ຕັດຊ່ອງວ່າງ/ຂີດ ແລ້ວ fallback ທຽບສະເພາະຕົວເລກ
 *   2) ບິນ TMS ບາງໃບພິມຜິດ (ໃສ່ຈຳນວນເງິນລົງຊ່ອງລິດ / ຈຳນວນເງິນເກີນຈິງ) — ກັ່ນອອກດ້ວຍ
 *      ຊ່ວງລິດ ແລະ ລາຄາຕໍ່ລິດທີ່ເປັນໄປໄດ້ ແລ້ວລາຍງານຈຳນວນໃບທີ່ຂ້າມ
 *
 * ⚠ ເຫດການເຊັນເຊີມີຍ້ອນຫຼັງເທົ່າທີ່ cron ດຶງມາ (`sensorSince`) — ຖ້າຊ່ວງລາຍງານເກົ່າກວ່ານັ້ນ
 *   ການທຽບຈະຄິດສະເພາະຊ່ວງທີ່ມີຂໍ້ມູນ ແລະ ໜ້າ UI ຕ້ອງບອກຜູ້ອ່ານ
 */

/**
 * ບິນມັກສູງກວ່າລິດທີ່ເຊັນເຊີເຫັນເປັນລະບົບ (ເຕີມຫຼາຍຈຸດຕໍ່ຄັ້ງ, ເຊັນເຊີອ່ານຊ້າ, ຄ່າ % ຖັງບໍ່ເປັນເສັ້ນຊື່)
 * ຈຶ່ງບໍ່ວັດຈາກ 0 ແຕ່ວັດ "ຕ່າງຈາກຄ່າກາງຂອງ fleet ໃນເດືອນນັ້ນ" — ຕັດ bias ອອກ ເຫຼືອແຕ່ຄັນທີ່ຜິດຈາກໝູ່
 */
export const VARIANCE_LIMIT_PCT = 40;
/** ຕ້ອງຕ່າງເປັນລິດພໍສົມຄວນນຳ — ກັນຄັນທີ່ເຕີມໜ້ອຍແລ້ວ % ແກວ່ງແຮງ */
export const VARIANCE_MIN_LITRE = 20;
/** ລິດຕໍ່ 1 ບິນ ທີ່ເປັນໄປໄດ້ */
const LITRE_MIN = 1;
const LITRE_MAX = 200;
/** ລາຄາຕໍ່ລິດທີ່ເປັນໄປໄດ້ (ກີບ) */
const PRICE_MIN = 5_000;
const PRICE_MAX = 60_000;

export type FuelCostStatus = "OK" | "CHECK" | "NO_BILL" | "NO_EVENT" | "NO_RECORD" | "NO_SENSOR_WINDOW" | "NO_DATA";

export type FleetCostRow = {
  vehicleId: string;
  plate: string;
  name: string;
  department: string | null;
  imei: string | null;
  source: FuelBillSource;
  /** GPS */
  distanceKm: number;
  gpsFuelLitre: number | null;
  /** ບິນ ໃນຊ່ວງລາຍງານທັງໝົດ */
  billCount: number;
  billLitre: number;
  billAmount: number;
  billSkipped: number;
  /** ເຊັນເຊີ (ໃນຊ່ວງທີ່ມີຂໍ້ມູນ) */
  refuelCount: number;
  refuelLitre: number;
  dropCount: number;
  dropLitre: number;
  /** ບິນສະເພາະຊ່ວງທີ່ເຊັນເຊີມີຂໍ້ມູນ — ໃຊ້ທຽບໃຫ້ຍຸດຕິທຳ */
  billLitreCompared: number;
  billCountCompared: number;
  /** ສ້ອມແປງ (LAK) */
  maintCount: number;
  maintAmount: number;
  maintOtherCurrency: boolean;
  /** ຄິດຕໍ່ */
  kipPerKm: number | null;
  kmPerLitre: number | null;
  variancePct: number | null;
  /** ຕ່າງຈາກຄ່າກາງຂອງ fleet (ຈຸດເປີເຊັນ) — ໃຊ້ຕັດສິນວ່າຄວນກວດ */
  varianceVsMedian: number | null;
  status: FuelCostStatus;
};

export type FleetCostReport = {
  rows: FleetCostRow[];
  /** ວັນທຳອິດທີ່ມີເຫດການເຊັນເຊີໃນ DB (YYYY-MM-DD) — null ເມື່ອຍັງບໍ່ມີເລີຍ */
  sensorSince: string | null;
  /** ຊ່ວງທີ່ໃຊ້ທຽບຈິງ (from ຖືກເລື່ອນມາຫາ sensorSince ເມື່ອຈຳເປັນ) */
  compareFrom: string;
  /** ຊ່ວງລາຍງານທຽບບໍ່ໄດ້ເຕັມ ເພາະເຊັນເຊີຍັງບໍ່ມີຂໍ້ມູນເກົ່າຂະໜາດນັ້ນ */
  comparePartial: boolean;
  /** ໃບບິນທີ່ຖືກກັ່ນອອກ (ຄ່າຜິດປົກກະຕິ) ທັງ fleet */
  skippedBills: number;
  /** ຄ່າກາງຂອງ "ບິນ ທຽບ ເຊັນເຊີ" ໃນຊ່ວງນີ້ (%) — null ເມື່ອຂໍ້ມູນບໍ່ພໍ */
  medianVariancePct: number | null;
};

const n = (v: unknown): number => (v == null ? 0 : Number(v));

type BillAgg = { count: number; litre: number; amount: number; skipped: number };
const emptyBill = (): BillAgg => ({ count: 0, litre: 0, amount: 0, skipped: 0 });

/** ບິນ TMS ຈັດກຸ່ມຕາມ `car` (ຍັງບໍ່ທັນຈັບຄູ່ກັບລົດ) */
function tmsBillQuery(from: string, to: string) {
  return prisma.$queryRaw<Record<string, unknown>[]>`
    select regexp_replace(lower(coalesce(car, '')), '[[:space:]._-]+', '', 'g') car_key,
           regexp_replace(coalesce(car, ''), '[^0-9]', '', 'g') car_digits,
           count(*) filter (where ok) ::int bills,
           coalesce(sum(case when ok then liters else 0 end), 0) litre,
           coalesce(sum(case when ok then amount else 0 end), 0) amount,
           count(*) filter (where not ok) ::int skipped
      from (
        select car, liters, amount,
               (liters between ${LITRE_MIN} and ${LITRE_MAX}
                and amount > 0
                and amount / liters between ${PRICE_MIN} and ${PRICE_MAX}) ok
          from odg_tms_fuel_log
         where fuel_date between ${from}::date and ${to}::date
      ) f
     group by 1, 2`;
}

function saleBillQuery(from: string, to: string) {
  return prisma.$queryRaw<Record<string, unknown>[]>`
    select t.vehicle_id,
           count(*) filter (where ok) ::int bills,
           coalesce(sum(case when ok then e.litre else 0 end), 0) litre,
           coalesce(sum(case when ok then e.amount else 0 end), 0) amount,
           count(*) filter (where not ok) ::int skipped
      from (
        select id, trip_id, litre, amount,
               (amount > 0 and (litre is null or litre between ${LITRE_MIN} and ${LITRE_MAX})) ok
          from hrm_sale_trip_expense
         where type in ('FUEL', 'ນ້ຳມັນ')
           and incurred_at >= ${`${from}T00:00:00+07:00`}::timestamptz
           and incurred_at <  ${`${to}T23:59:59+07:00`}::timestamptz
      ) e
      join hrm_vehicle_trip t on t.id = e.trip_id
     group by 1`;
}

export async function fleetFuelCost(from: string, to: string): Promise<FleetCostReport> {
  const sinceRow = await prisma.$queryRaw<{ since: string | null }[]>`
    select to_char(min(event_time) at time zone 'Asia/Vientiane', 'YYYY-MM-DD') since
      from hrm_vehicle_refuel_event`;
  const sensorSince = sinceRow[0]?.since ?? null;
  const compareFrom = sensorSince && sensorSince > from ? sensorSince : from;
  const comparePartial = compareFrom !== from;

  const [vehicles, departments, daily, events, tmsBills, saleBills, maint, tmsCompare, saleCompare] =
    await Promise.all([
      prisma.carVehicle.findMany({
        select: { id: true, plateNo: true, name: true, departmentCode: true, gpsImei: true },
        orderBy: { plateNo: "asc" },
      }),
      prisma.department.findMany({ select: { code: true, nameLo: true } }),
      fuelDailyRows(from, to),
      refuelEventsBetween(new Date(`${compareFrom}T00:00:00+07:00`), new Date(`${to}T23:59:59+07:00`)),
      tmsBillQuery(from, to),
      saleBillQuery(from, to),
      prisma.$queryRaw<Record<string, unknown>[]>`
        select regexp_replace(lower(coalesce(car_code, '')), '[[:space:]._-]+', '', 'g') car_key,
               regexp_replace(coalesce(car_code, ''), '[^0-9]', '', 'g') car_digits,
               count(*)::int jobs,
               coalesce(sum(case when coalesce(currency, 'LAK') = 'LAK' then coalesce(cost_amount, 0) else 0 end), 0) lak,
               bool_or(coalesce(currency, 'LAK') <> 'LAK') other_currency
          from odg_tms_maint_log
         where maint_date between ${from}::date and ${to}::date
         group by 1, 2`,
      comparePartial ? tmsBillQuery(compareFrom, to) : Promise.resolve(null),
      comparePartial ? saleBillQuery(compareFrom, to) : Promise.resolve(null),
    ]);

  const deptName = new Map(departments.map((d) => [d.code, d.nameLo]));

  // GPS ລາຍວັນ → ຕໍ່ imei
  const gps = new Map<string, { km: number; litre: number; hasLitre: boolean }>();
  for (const r of daily) {
    const cur = gps.get(r.imei) ?? { km: 0, litre: 0, hasLitre: false };
    cur.km += r.distance_km;
    if (r.fuel_used_litre != null) {
      cur.litre += r.fuel_used_litre;
      cur.hasLitre = true;
    }
    gps.set(r.imei, cur);
  }

  // ເຫດການເຊັນເຊີ → ຕໍ່ imei (ບໍ່ນັບອັນທີ່ຄົນປະຕິເສດແລ້ວ)
  const sensor = new Map<string, { refuel: number; refuelLitre: number; drop: number; dropLitre: number }>();
  for (const e of events) {
    if (e.confidence === "REJECTED") continue;
    const cur = sensor.get(e.imei) ?? { refuel: 0, refuelLitre: 0, drop: 0, dropLitre: 0 };
    if (e.kind === "REFUEL") {
      cur.refuel += 1;
      cur.refuelLitre += e.litre;
    } else {
      cur.drop += 1;
      cur.dropLitre += e.litre;
    }
    sensor.set(e.imei, cur);
  }

  /** ແຖວ TMS (ຈັດກຸ່ມຕາມ car/car_code ແລ້ວ) ແມ່ນຂອງລົດປ້າຍນີ້ບໍ */
  const matchesPlate = (r: Record<string, unknown>, plate: string) => {
    const key = plateKey(plate);
    const digits = plateDigits(plate);
    return (
      (key !== "" && String(r.car_key) === key) ||
      (digits.length >= 4 && String(r.car_digits) === digits)
    );
  };

  /** ລວມແຖວບິນ TMS ຂອງລົດຄັນນີ້ */
  const tmsFor = (rows: Record<string, unknown>[], plate: string): BillAgg => {
    const out = emptyBill();
    for (const r of rows) {
      if (!matchesPlate(r, plate)) continue;
      out.count += n(r.bills);
      out.litre += n(r.litre);
      out.amount += n(r.amount);
      out.skipped += n(r.skipped);
    }
    return out;
  };
  const saleFor = (rows: Record<string, unknown>[], vehicleId: string): BillAgg => {
    const r = rows.find((x) => String(x.vehicle_id) === vehicleId);
    return r
      ? { count: n(r.bills), litre: n(r.litre), amount: n(r.amount), skipped: n(r.skipped) }
      : emptyBill();
  };

  let skippedBills = 0;
  const rows = vehicles.map((v) => {
    const imei = v.gpsImei?.trim() || null;
    const source = fuelBillSource(v.departmentCode);
    const g = imei ? gps.get(imei) : undefined;
    const s = (imei && sensor.get(imei)) || { refuel: 0, refuelLitre: 0, drop: 0, dropLitre: 0 };
    const vehicleId = v.id.toString();

    const bill = source === "TMS" ? tmsFor(tmsBills, v.plateNo) : saleFor(saleBills, vehicleId);
    const compared = !comparePartial
      ? bill
      : source === "TMS"
        ? tmsFor(tmsCompare ?? [], v.plateNo)
        : saleFor(saleCompare ?? [], vehicleId);
    skippedBills += bill.skipped;

    const distanceKm = g?.km ?? 0;
    let maintCount = 0;
    let maintAmount = 0;
    let maintOtherCurrency = false;
    for (const m of maint) {
      if (!matchesPlate(m, v.plateNo)) continue;
      maintCount += n(m.jobs);
      maintAmount += n(m.lak);
      maintOtherCurrency ||= m.other_currency === true;
    }

    const kipPerKm = distanceKm >= 1 && bill.amount + maintAmount > 0 ? (bill.amount + maintAmount) / distanceKm : null;
    const kmPerLitre = distanceKm >= 1 && bill.litre > 0 ? distanceKm / bill.litre : null;
    const variancePct =
      compared.litre > 0 && s.refuelLitre > 0
        ? ((compared.litre - s.refuelLitre) / s.refuelLitre) * 100
        : null;


    return {
      vehicleId,
      plate: v.plateNo,
      name: v.name,
      department: (v.departmentCode && deptName.get(v.departmentCode)) || null,
      imei,
      source,
      distanceKm,
      gpsFuelLitre: g?.hasLitre ? g.litre : null,
      billCount: bill.count,
      billLitre: bill.litre,
      billAmount: bill.amount,
      billSkipped: bill.skipped,
      refuelCount: s.refuel,
      refuelLitre: s.refuelLitre,
      dropCount: s.drop,
      dropLitre: s.dropLitre,
      billLitreCompared: compared.litre,
      billCountCompared: compared.count,
      maintCount,
      maintAmount,
      maintOtherCurrency,
      kipPerKm,
      kmPerLitre,
      variancePct,
      varianceVsMedian: null as number | null,
      status: "OK" as FuelCostStatus,
    };
  });

  // ຄ່າກາງຂອງ fleet ກ່ອນ ແລ້ວຈຶ່ງຕັດສິນສະຖານະ (ຕັດ bias ຂອງວິທີວັດອອກ)
  const variances = rows.map((r) => r.variancePct).filter((v): v is number => v != null).sort((a, b) => a - b);
  const medianVariancePct = variances.length >= 3
    ? variances.length % 2
      ? variances[(variances.length - 1) / 2]
      : (variances[variances.length / 2 - 1] + variances[variances.length / 2]) / 2
    : null;
  const noSensorWindow = sensorSince == null || sensorSince > to;

  for (const r of rows) {
    const litreGap = Math.abs(r.billLitreCompared - r.refuelLitre);
    r.varianceVsMedian = r.variancePct == null ? null : r.variancePct - (medianVariancePct ?? 0);
    r.status =
      r.distanceKm < 1 && r.billCount === 0 && r.refuelCount === 0
        ? "NO_DATA"
        : r.dropCount > 0 ||
            (r.varianceVsMedian != null &&
              Math.abs(r.varianceVsMedian) > VARIANCE_LIMIT_PCT &&
              litreGap >= VARIANCE_MIN_LITRE)
          ? "CHECK"
          : noSensorWindow
            ? "NO_SENSOR_WINDOW"
            : r.billCountCompared === 0 && r.refuelCount > 0
              ? "NO_BILL"
              : r.billCountCompared > 0 && r.refuelCount === 0
                ? "NO_EVENT"
                : r.billCountCompared === 0 && r.refuelCount === 0
                  ? "NO_RECORD"
                  : "OK";
  }

  return { rows, sensorSince, compareFrom, comparePartial, skippedBills, medianVariancePct };
}

export const STATUS_LABEL: Record<FuelCostStatus, { text: string; tone: "green" | "amber" | "red" | "gray" }> = {
  OK: { text: "ປົກກະຕິ", tone: "green" },
  CHECK: { text: "ຄວນກວດ", tone: "red" },
  NO_BILL: { text: "ເຕີມແຕ່ບໍ່ມີບິນ", tone: "amber" },
  NO_EVENT: { text: "ມີບິນແຕ່ຖັງບໍ່ຂຶ້ນ", tone: "amber" },
  NO_RECORD: { text: "ບໍ່ມີບັນທຶກທັງສອງຝັ່ງ", tone: "amber" },
  NO_SENSOR_WINDOW: { text: "ຍັງບໍ່ມີຂໍ້ມູນເຊັນເຊີ", tone: "gray" },
  NO_DATA: { text: "ບໍ່ມີຂໍ້ມູນ", tone: "gray" },
};
