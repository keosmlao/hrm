/**
 * ⚠⚠ ລຶບລົດທັງໝົດໃນ `app_car_vehicles` ແລ້ວສ້າງຄືນຈາກ Lao GPS Open API.
 *
 * ການລຶບ CASCADE ໄປຫາ app_car_gps_tracks / fuel_logs / service_logs /
 * vehicle_documents / incidents ແລະ ຕັ້ງ app_car_bookings.vehicle_id = null.
 * ໄມລ໌, ພະແນກ ແລະ id ເກົ່າຂອງລົດ **ຫາຍຖາວອນ**.
 *
 *   npm run gps:reset-vehicles                 # ເບິ່ງແຜນ (ບໍ່ຂຽນ)
 *   npm run gps:reset-vehicles -- --apply      # ລຶບ+ສ້າງຄືນແທ້
 *
 * ສຳຮອງກ່ອນ: scripts/laogps-backup.ts (ຫຼື npm run gps:backup)
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { laoGpsConfigured, laoGpsErrorMessage, listVehicles } from "../src/lib/laogps";
import {
  DEFAULT_STATUS,
  fallbackPlateFor,
  resetVehiclesFromGps,
  typeIdForCategory,
  DEFAULT_TYPE_ID,
} from "../src/lib/laogps-sync";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

async function main() {
  if (!laoGpsConfigured()) {
    console.error("✗ ຍັງບໍ່ໄດ້ຕັ້ງ GPS_OPENAPI_USER / GPS_OPENAPI_PASS ໃນ .env");
    process.exit(1);
  }

  const [gps, before] = await Promise.all([
    listVehicles({ limit: 2000 }),
    prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) n from app_car_vehicles`),
  ]);
  const tracks = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `select count(*) n from app_car_gps_tracks`,
  );

  console.log(`ຈະລຶບ ${before[0].n} ແຖວໃນ app_car_vehicles`);
  console.log(`  ↳ CASCADE ພາລຶບ app_car_gps_tracks ${tracks[0].n} ແຖວ`);
  console.log(`ແລ້ວສ້າງຄືນ ${gps.length} ຄັນຈາກ LaoGPS:\n`);

  const types = await prisma.carVehicleType.findMany();
  const typeName = new Map(types.map((t) => [t.id.toString(), t.name]));

  for (const v of gps) {
    const imei = v.imei.trim();
    const plate = v.plate?.trim();
    const bad = !plate || /^(ไม่ระบุ|ບໍ່ລະບຸ)/i.test(plate);
    const tid = typeIdForCategory(v.category, DEFAULT_TYPE_ID).toString();
    console.log(
      `  ${(bad ? fallbackPlateFor(imei) : plate!).padEnd(16)} ` +
        `"${v.car_model ?? "-"}"`.padEnd(12) +
        ` ${(typeName.get(tid) ?? tid).padEnd(12)} ${String(v.category ?? "-").padEnd(18)}` +
        ` imei=${imei}${bad ? "  (ປ້າຍສຳຮອງ)" : ""}`,
    );
  }

  if (!APPLY) {
    console.log(`\n⚠ DRY-RUN — ຍັງບໍ່ໄດ້ແຕະ DB. ໃສ່ --apply ຈຶ່ງລຶບ+ສ້າງຄືນແທ້`);
    return;
  }

  console.log("\nກຳລັງລຶບ ແລະ ສ້າງຄືນ...");
  const res = await resetVehiclesFromGps({ status: DEFAULT_STATUS });
  console.log(
    `\n✓ ລຶບ ${res.deleted} ແຖວ · ສ້າງຄືນ ${res.inserted} ຄັນ · ` +
      `ຂໍ້ມູນ GPS ລະອຽດ ${res.gpsInfo} ຄັນ (hrm_vehicle_gps)`,
  );
}

main()
  .catch((e) => {
    console.error(`\n✗ ຜິດພາດ: ${laoGpsErrorMessage(e)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
