/**
 * ⛽ Sync ນ້ຳມັນຈາກ Lao GPS ລົງ DB (hrm_vehicle_fuel_daily · hrm_vehicle_refuel_event · hrm_vehicle_fuel_sync)
 * ໃຫ້ໜ້າລາຍງານ HRM /fleet/fuel, /fleet/trips/[id] ແລະ SALE /plan/[id], /fleet ອ່ານທັນທີ
 *
 *   npm run gps:sync-fuel                    # ມື້ນີ້ + ມື້ວານ (/fuel) ແລະ ເຕີມ ຕໍ່ຈາກ watermark (ຄັ້ງທຳອິດ 7 ວັນ)
 *   npm run gps:sync-fuel -- --days=31       # backfill 31 ວັນ (ຄັ້ງທຳອິດ) — ~1.5 ວິ/ວັນ ສຳລັບ /fuel
 *   npm run gps:sync-fuel -- --refuel-days=14 --concurrency=2
 *   npm run gps:sync-fuel -- --skip-refuel   # ສະເພາະຕົວເລກລາຍວັນ
 * ທຸກຮອບຈະ: ສະເໜີຈຸດເຕີມຈາກ cluster ເຫດການ + ໃຫ້ຄະແນນເຫດການ 30 ວັນ (ຈຸດເຕີມ/ບິນ/ຄວາມສົມເຫດ/ຄົນຂັບຢືນຢັນ)
 *
 * cron ແນະນຳ (ທຸກຊົ່ວໂມງ, ຢູ່ server HRM):
 *   7 * * * * cd /path/HRM && npm run -s gps:sync-fuel >> /var/log/hrm-fuel-sync.log 2>&1
 * ⚠ ຢ່າແລ່ນຊ້ອນກັນຫຼາຍ process — provider ຊ້າ ແລະ ຈຳກັດ login
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { laoGpsConfigured, laoGpsErrorMessage } from "../src/lib/laogps";
import { scoreRefuelEvents, suggestStationsFromEvents, syncFuelDaily, syncRefuels } from "../src/lib/fuel-cache";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => args.find((a) => a.startsWith(`${f}=`))?.split("=")[1];

async function main() {
  if (!laoGpsConfigured()) {
    console.error("✗ ຍັງບໍ່ໄດ້ຕັ້ງ GPS_OPENAPI_USER / GPS_OPENAPI_PASS ໃນ .env");
    process.exit(1);
  }
  const days = Number(val("--days") ?? 2);
  const t0 = Date.now();
  console.log(`[${new Date().toISOString()}] sync fuel daily ${days} ວັນ …`);
  const rows = await syncFuelDaily(days, (s) => console.log("  " + s));
  console.log(`  ✓ ${rows} ແຖວ (${Math.round((Date.now() - t0) / 1000)} ວິ)`);

  if (!has("--skip-refuel")) {
    const t1 = Date.now();
    console.log(`sync refuel events …`);
    const r = await syncRefuels({
      backfillDays: Number(val("--refuel-days") ?? 7),
      concurrency: Number(val("--concurrency") ?? 3),
      log: (s) => console.log("  " + s),
    });
    console.log(`  ✓ ${r.vehicles} ຄັນ sensor · ເຕີມ ${r.events} ເຫດການ (${Math.round((Date.now() - t1) / 1000)} ວິ)`);
  }

  // ຈຸດເຕີມໃໝ່ຈາກ cluster (≥ 3 ຄັ້ງ/150 m) + ໃຫ້ຄະແນນເຫດການ 30 ວັນ (ຈຸດເຕີມ · ບິນ · ຄວາມສົມເຫດ · ຄົນຂັບຢືນຢັນ)
  const created = await suggestStationsFromEvents("cron");
  if (created) console.log(`  + ສະເໜີຈຸດເຕີມໃໝ່ ${created} ຈຸດ (ຕັ້ງຊື່ຢູ່ HRM → ລົດ → ລາຍງານນ້ຳມັນ → ຈຸດເຕີມ)`);
  const scored = await scoreRefuelEvents(30);
  console.log(`  ✓ ໃຫ້ຄະແນນ ${scored} ເຫດການ`);
}

main()
  .catch((e) => {
    console.error("✗", laoGpsErrorMessage(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
