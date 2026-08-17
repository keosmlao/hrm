import "server-only";
import { prisma } from "./prisma";
import { listVehicles, type LaoGpsVehicle } from "./laogps";

/**
 * ດຶງລາຍການລົດຈາກ Lao GPS Open API ມາເພີ່ມໃສ່ `app_car_vehicles`.
 *
 * ⚠ `app_car_vehicles` ເປັນຕາຕະລາງຂອງລະບົບ ERP — ຈຶ່ງແຍກເປັນ 2 ຂັ້ນຕອນ:
 *   `planVehicleSync()` ຄິດວ່າຈະປ່ຽນຫຍັງ (ບໍ່ຂຽນ) → `applyVehicleSync()` ຂຽນຈິງ.
 *
 * ຫຼັກການ: ຈັບຄູ່ດ້ວຍ `gps_imei` (UNIQUE ໃນ DB) · ເພີ່ມຢ່າງດຽວ ບໍ່ລຶບ ·
 * ບໍ່ແກ້ plate_no/name ຂອງແຖວເກົ່າ ນອກຈາກສັ່ງ `updateNames` (ERP ເປັນເຈົ້າຂອງ).
 */

/** ຄ່າ default ຂອງລົດໃໝ່ — ຕາມແຖວທີ່ import ໄວ້ກ່ອນໜ້າ */
export const DEFAULT_TYPE_ID = BigInt(5);
export const DEFAULT_STATUS = "available";

export type SyncOptions = {
  typeId?: bigint;
  status?: string;
  /** ອັບເດດ plate_no/name ຂອງລົດທີ່ມີຢູ່ແລ້ວໃຫ້ຕາມ GPS ນຳ */
  updateNames?: boolean;
};

type DbRow = { id: bigint; plate_no: string; name: string; gps_imei: string | null };

export type InsertPlan = {
  imei: string;
  plate: string;
  name: string;
  fallbackPlate: boolean;
  /** ປະເພດລົດທີ່ແປງມາຈາກ `category` ຂອງ GPS */
  typeId: string;
  category: string | null;
};
export type UpdatePlan = {
  id: string;
  imei: string;
  fromPlate: string;
  toPlate: string;
  fromName: string;
  toName: string;
};
export type SkipPlan = { label: string; why: string };
export type OrphanRow = { id: string; plate: string; imei: string };

export type SyncPlan = {
  gpsCount: number;
  dbCount: number;
  matched: number;
  insert: InsertPlan[];
  update: UpdatePlan[];
  skipped: SkipPlan[];
  /** ມີໃນ DB ແຕ່ບໍ່ມີໃນບັນຊີ LaoGPS — ລາຍງານເທົ່ານັ້ນ ບໍ່ລຶບ */
  orphans: OrphanRow[];
  options: { typeId: string; status: string; updateNames: boolean };
};

/** ປ້າຍທະບຽນສຳຮອງ ເມື່ອ GPS ບໍ່ມີປ້າຍ — ຕາມແບບແຖວ `GPS-309017` ທີ່ມີຢູ່ */
export function fallbackPlateFor(imei: string): string {
  return `GPS-${imei.slice(-6)}`;
}

/**
 * ຄ່າທີ່ GPS ໃສ່ແທນ "ບໍ່ມີຂໍ້ມູນ" — ຕ້ອງຖືວ່າວ່າງ ບໍ່ດັ່ງນັ້ນຈະໄດ້ລົດປ້າຍ "ไม่ระบุ".
 * ພົບຈິງໃນຂໍ້ມູນ: plate = "ไม่ระบุ", province = "ບໍ່ລະບຸແຂວງ".
 */
const PLACEHOLDER = /^(ไม่ระบุ|ບໍ່ລະບຸ.*|ไม่มี|n\/?a|-+|0+)$/i;

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return !t || PLACEHOLDER.test(t) ? null : t;
}

/**
 * ບາງຄັນ GPS ໃສ່ປ້າຍທະບຽນໄວ້ໃນຟິວ `name` ແທນ `plate` (ຕົວຢ່າງ imei …417869:
 * `plate:"ไม่ระบุ"` ແຕ່ `name:" ກບ-3646"`). ກວດແລ້ວ ຄັນທີ່ `name` ເປັນຮູບແບບປ້າຍ
 * ຈະກົງກັບ `plate` ສະເໝີ ຈຶ່ງໃຊ້ເປັນຕົວສຳຮອງໄດ້.
 *
 * ຕ້ອງມີທັງຕົວອັກສອນ ແລະ ລົງທ້າຍດ້ວຍ 3-4 ຕົວເລກ — ຄັດ "odienmall" (ບໍ່ມີເລກ),
 * "6264" (ບໍ່ມີອັກສອນ) ແລະ "864022088382980" (IMEI) ອອກ.
 */
function plateFromName(name: string | null | undefined): string | null {
  const t = clean(name);
  if (!t || t.length > 12) return null;
  return /\p{L}/u.test(t) && /\d{3,4}$/.test(t) ? t : null;
}

/**
 * ຊື່ລົດ = `car_model` (TOYOTA/ISUZU/HYUNDAI…) ເຊິ່ງຄົບທຸກຄັນ ແລະ ກົງກັບແຖວເກົ່າ.
 * ⚠ ຢ່າໃຊ້ `v.name`: ຟິວນັ້ນມີພຽງ ~40% ຂອງລົດ ແລະ ຄ່າປົນກັນ —
 * ບາງຄັນເປັນປ້າຍທະບຽນ ບາງຄັນເປັນຊື່ບັນຊີ ("odienmall").
 */
function pickName(v: LaoGpsVehicle): string {
  return (clean(v.car_model) || clean(v.name) || clean(v.plate) || `GPS ${v.imei}`).slice(0, 190);
}

/** ປະເພດລົດຕາມ `category` ຂອງ GPS (ພາສາໄທ) → app_car_vehicle_types */
const CATEGORY_TYPE: { match: RegExp; typeId: number }[] = [
  { match: /จักรยานยนต์|มอเตอร์ไซค|ຈັກ/i, typeId: 6 }, // ລົດຈັກ
  { match: /กระบะ|ກະບະ|pickup/i, typeId: 2 }, // ລົດກະບະ
  { match: /ตู้|ຕູ້|van/i, typeId: 3 }, // ລົດຕູ້
  { match: /suv/i, typeId: 4 }, // SUV
  { match: /เก๋ง|ເກັງ|sedan/i, typeId: 1 }, // ລົດເກັງ
  { match: /บรรทุก|ບັນທຸກ|truck/i, typeId: 5 }, // ລົດບັນທຸກ
];

/** ປະເພດລົດຈາກ category — ບໍ່ຮູ້ຈັກ ໃຫ້ຕົກເປັນ `fallback` */
export function typeIdForCategory(category: string | null, fallback: bigint): bigint {
  const c = clean(category);
  if (!c) return fallback;
  return BigInt(CATEGORY_TYPE.find((r) => r.match.test(c))?.typeId ?? Number(fallback));
}

/** ຂໍ້ມູນ GPS ທີ່ເກັບໃສ່ `hrm_vehicle_gps` — ຟິວທີ່ app_car_vehicles ບໍ່ມີບ່ອນເກັບ */
export function gpsInfoRow(v: LaoGpsVehicle) {
  const date = (s: string | null) => (s ? new Date(s) : null);
  return {
    imei: v.imei.trim(),
    gpsVehicleId: v.vehicle_id ?? null,
    plate: clean(v.plate),
    carModel: clean(v.car_model),
    category: clean(v.category),
    province: clean(v.province),
    chassis: clean(v.chassis),
    asset: clean(v.asset),
    deviceModel: clean(v.device_model),
    sim: clean(v.sim),
    active: Boolean(v.active),
    hasCamera: Boolean(v.has_camera),
    overspeedKmh: v.overspeed_kmh ?? null,
    parkLimitMin: v.park_limit_min ?? null,
    tankLitre: v.fuel_capability?.tank_litre ?? null,
    kmPerLitre: v.fuel_capability?.km_per_litre ?? null,
    fuelMethod: v.fuel_capability?.method ?? null,
    fuelReason: v.fuel_capability?.reason ?? null,
    expireDate: date(v.expire_date),
    registeredAt: date(v.registered_at),
    lastSeenAt: date(v.last_seen_at),
    syncedAt: new Date(),
  };
}

/** ຄິດແຜນການປ່ຽນແປງ — ບໍ່ຂຽນ DB */
export async function planVehicleSync(opts: SyncOptions = {}): Promise<SyncPlan> {
  const typeId = opts.typeId ?? DEFAULT_TYPE_ID;
  const status = opts.status ?? DEFAULT_STATUS;
  const updateNames = opts.updateNames ?? false;

  const [gps, db] = await Promise.all([
    listVehicles({ limit: 2000 }),
    prisma.$queryRawUnsafe<DbRow[]>(
      `select id, plate_no, name, gps_imei from app_car_vehicles order by id`,
    ),
  ]);

  const byImei = new Map<string, DbRow>();
  for (const r of db) {
    const k = r.gps_imei?.trim();
    if (k) byImei.set(k, r);
  }
  const takenPlates = new Set(db.map((r) => r.plate_no.trim()));

  const insert: InsertPlan[] = [];
  const update: UpdatePlan[] = [];
  const skipped: SkipPlan[] = [];
  let matched = 0;

  for (const v of gps) {
    const imei = v.imei?.trim();
    const label = v.plate?.trim() || v.name?.trim() || v.imei || "-";
    if (!imei) {
      skipped.push({ label, why: "ບໍ່ມີ IMEI" });
      continue;
    }

    const existing = byImei.get(imei);
    if (existing) {
      matched += 1;
      if (!updateNames) continue;
      const gpsPlate = clean(v.plate) ?? plateFromName(v.name);
      const plateChanged = Boolean(gpsPlate && gpsPlate !== existing.plate_no && !takenPlates.has(gpsPlate));
      const name = pickName(v);
      if (plateChanged || name !== existing.name) {
        update.push({
          id: existing.id.toString(),
          imei,
          fromPlate: existing.plate_no,
          toPlate: plateChanged ? gpsPlate! : existing.plate_no,
          fromName: existing.name,
          toName: name,
        });
      }
      continue;
    }

    // ລົດໃໝ່ — ຫາປ້າຍທີ່ບໍ່ຊ້ຳ (ຄ່າ placeholder ຖືວ່າວ່າງ)
    const gpsPlate = clean(v.plate) ?? plateFromName(v.name);
    const fb = fallbackPlateFor(imei);
    let plate: string | null = null;
    let usedFallback = false;
    if (gpsPlate && !takenPlates.has(gpsPlate)) {
      plate = gpsPlate;
    } else if (!takenPlates.has(fb)) {
      plate = fb;
      usedFallback = true;
    }
    if (!plate) {
      skipped.push({ label, why: `ປ້າຍ "${gpsPlate ?? "-"}" ແລະ ${fb} ຖືກໃຊ້ແລ້ວ` });
      continue;
    }
    takenPlates.add(plate);
    insert.push({
      imei,
      plate,
      name: pickName(v),
      fallbackPlate: usedFallback,
      typeId: typeIdForCategory(v.category, typeId).toString(),
      category: clean(v.category),
    });
  }

  const gpsImei = new Set(gps.map((v) => v.imei?.trim()).filter(Boolean));
  const orphans = db
    .filter((r) => r.gps_imei?.trim() && !gpsImei.has(r.gps_imei.trim()))
    .map((r) => ({ id: r.id.toString(), plate: r.plate_no, imei: r.gps_imei!.trim() }));

  return {
    gpsCount: gps.length,
    dbCount: db.length,
    matched,
    insert,
    update,
    skipped,
    orphans,
    options: { typeId: typeId.toString(), status, updateNames },
  };
}

export type SyncResult = { inserted: number; updated: number; conflicts: number; gpsInfo: number };

/**
 * ຂຽນແຜນລົງ DB ໃນ transaction ດຽວ.
 * `on conflict (gps_imei) do nothing` ກັນກໍລະນີມີຄົນເພີ່ມພ້ອມກັນລະຫວ່າງ plan ກັບ apply.
 * ພ້ອມກັນນັ້ນ ຊິງຄ໌ຂໍ້ມູນ GPS ເຕັມຂອງລົດ **ທຸກຄັນ** ໃສ່ `hrm_vehicle_gps`
 * (ບໍ່ແມ່ນສະເພາະຄັນໃໝ່ — ຂໍ້ມູນເຊັ່ນ ວັນໝົດອາຍຸ / SIM ປ່ຽນໄດ້ຕະຫຼອດ).
 */
export async function applyVehicleSync(plan: SyncPlan): Promise<SyncResult> {
  const gps = await listVehicles({ limit: 2000 });

  return prisma.$transaction(async (tx) => {
    let inserted = 0;
    for (const x of plan.insert) {
      inserted += await tx.$executeRawUnsafe(
        `insert into app_car_vehicles
           (plate_no, name, status, current_mileage, vehicle_type_id, gps_imei, created_at, updated_at)
         values ($1, $2, $3, 0, $4, $5, now(), now())
         on conflict (gps_imei) do nothing`,
        x.plate,
        x.name,
        plan.options.status,
        BigInt(x.typeId),
        x.imei,
      );
    }

    let updated = 0;
    for (const x of plan.update) {
      updated += await tx.$executeRawUnsafe(
        `update app_car_vehicles set plate_no = $1, name = $2, updated_at = now() where id = $3`,
        x.toPlate,
        x.toName,
        BigInt(x.id),
      );
    }

    let gpsInfo = 0;
    for (const v of gps) {
      if (!v.imei?.trim()) continue;
      const row = gpsInfoRow(v);
      await tx.vehicleGpsInfo.upsert({ where: { imei: row.imei }, create: row, update: row });
      gpsInfo += 1;
    }

    return { inserted, updated, conflicts: plan.insert.length - inserted, gpsInfo };
  });
}

/**
 * ⚠ ລຶບລົດທັງໝົດໃນ `app_car_vehicles` ແລ້ວສ້າງຄືນຈາກ GPS.
 *
 * ການລຶບຈະ **CASCADE** ໄປຫາ `app_car_gps_tracks`, `app_car_fuel_logs`,
 * `app_car_service_logs`, `app_car_vehicle_documents`, `app_car_incidents`
 * ແລະ ຕັ້ງ `app_car_bookings.vehicle_id` ເປັນ null. ໄມລ໌, ພະແນກ ແລະ id ເກົ່າ
 * ຫາຍໝົດ. ສຳຮອງກ່ອນສະເໝີ.
 *
 * ທັງໝົດຢູ່ໃນ transaction ດຽວ — ຖ້າ insert ລົ້ມ ຈະ rollback ຄືນທັງໝົດ.
 */
export async function resetVehiclesFromGps(opts: SyncOptions = {}): Promise<{
  deleted: number;
  inserted: number;
  gpsInfo: number;
  rows: InsertPlan[];
}> {
  const fallbackType = opts.typeId ?? DEFAULT_TYPE_ID;
  const status = opts.status ?? DEFAULT_STATUS;
  const gps = await listVehicles({ limit: 2000 });

  // ຄິດແຖວທີ່ຈະສ້າງໄວ້ກ່ອນ ນອກ transaction — ຕາຕະລາງຈະຫວ່າງ ຈຶ່ງບໍ່ຕ້ອງທຽບກັບຂອງເກົ່າ
  const taken = new Set<string>();
  const rows: InsertPlan[] = [];
  for (const v of gps) {
    const imei = v.imei?.trim();
    if (!imei) continue;
    const gpsPlate = clean(v.plate) ?? plateFromName(v.name);
    const fb = fallbackPlateFor(imei);
    const plate = gpsPlate && !taken.has(gpsPlate) ? gpsPlate : !taken.has(fb) ? fb : `${fb}-${imei.slice(-3)}`;
    taken.add(plate);
    rows.push({
      imei,
      plate,
      name: pickName(v),
      fallbackPlate: plate !== gpsPlate,
      typeId: typeIdForCategory(v.category, fallbackType).toString(),
      category: clean(v.category),
    });
  }

  return prisma.$transaction(
    async (tx) => {
      const deleted = await tx.$executeRawUnsafe(`delete from app_car_vehicles`);

      let inserted = 0;
      for (const x of rows) {
        inserted += await tx.$executeRawUnsafe(
          `insert into app_car_vehicles
             (plate_no, name, status, current_mileage, vehicle_type_id, gps_imei, created_at, updated_at)
           values ($1, $2, $3, 0, $4, $5, now(), now())`,
          x.plate,
          x.name,
          status,
          BigInt(x.typeId),
          x.imei,
        );
      }

      let gpsInfo = 0;
      for (const v of gps) {
        if (!v.imei?.trim()) continue;
        const row = gpsInfoRow(v);
        await tx.vehicleGpsInfo.upsert({ where: { imei: row.imei }, create: row, update: row });
        gpsInfo += 1;
      }

      return { deleted, inserted, gpsInfo, rows };
    },
    { timeout: 120_000 },
  );
}
