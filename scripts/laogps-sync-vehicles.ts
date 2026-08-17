/**
 * ດຶງລາຍການລົດຈາກ Lao GPS Open API ມາເພີ່ມໃສ່ `app_car_vehicles` (ຜ່ານ terminal).
 * ໃຊ້ logic ອັນດຽວກັບປຸ່ມໃນໜ້າ "ຈັດການລົດ" — src/lib/laogps-sync.ts
 *
 * ⚠ dry-run ໂດຍ default. ຕ້ອງໃສ່ `--apply` ຈຶ່ງຈະຂຽນແທ້.
 *
 *   npm run gps:sync-vehicles              # ເບິ່ງວ່າຈະປ່ຽນຫຍັງແດ່
 *   npm run gps:sync-vehicles -- --apply
 *
 * ຕົວເລືອກ: --apply · --type-id=5 · --status=available · --update-names
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { laoGpsConfigured, laoGpsErrorMessage } from "../src/lib/laogps";
import { applyVehicleSync, planVehicleSync } from "../src/lib/laogps-sync";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => args.find((a) => a.startsWith(`${f}=`))?.split("=")[1];

async function main() {
  if (!laoGpsConfigured()) {
    console.error("✗ ຍັງບໍ່ໄດ້ຕັ້ງ GPS_OPENAPI_USER / GPS_OPENAPI_PASS ໃນ .env");
    process.exit(1);
  }

  const typeIdArg = val("--type-id");
  const plan = await planVehicleSync({
    typeId: typeIdArg ? BigInt(typeIdArg) : undefined,
    status: val("--status"),
    updateNames: has("--update-names"),
  });

  console.log(
    `LaoGPS ມີ ${plan.gpsCount} ຄັນ · app_car_vehicles ມີ ${plan.dbCount} ແຖວ · ຈັບຄູ່ໄດ້ ${plan.matched} ຄັນ\n`,
  );

  console.log(`── ຈະເພີ່ມໃໝ່ ${plan.insert.length} ຄັນ ──`);
  for (const x of plan.insert) {
    console.log(
      `  + ${x.plate.padEnd(16)} name="${x.name}" imei=${x.imei}` +
        `  type=${plan.options.typeId} status=${plan.options.status}` +
        (x.fallbackPlate ? "  (ປ້າຍສຳຮອງ — GPS ບໍ່ມີປ້າຍ)" : ""),
    );
  }

  if (plan.options.updateNames) {
    console.log(`\n── ຈະແກ້ຂໍ້ມູນ ${plan.update.length} ຄັນ ──`);
    for (const x of plan.update) {
      console.log(`  ~ id=${x.id} "${x.fromPlate}"→"${x.toPlate}"  "${x.fromName}"→"${x.toName}"`);
    }
  } else {
    console.log("\n(ບໍ່ແຕະ plate_no/name ຂອງແຖວເກົ່າ — ໃສ່ --update-names ຖ້າຢາກໃຫ້ແກ້ຕາມ GPS)");
  }

  if (plan.skipped.length) {
    console.log(`\n── ຂ້າມ ${plan.skipped.length} ຄັນ ──`);
    for (const s of plan.skipped) console.log(`  ! ${s.label}: ${s.why}`);
  }

  if (plan.orphans.length) {
    console.log(`\n── ມີໃນ DB ແຕ່ບໍ່ມີໃນບັນຊີ LaoGPS ${plan.orphans.length} ຄັນ (ບໍ່ລຶບ) ──`);
    for (const o of plan.orphans) console.log(`  ? id=${o.id} ${o.plate} imei=${o.imei}`);
  }

  if (!plan.insert.length && !plan.update.length) {
    console.log("\n✓ ບໍ່ມີຫຍັງຕ້ອງປ່ຽນ");
    return;
  }

  if (!has("--apply")) {
    console.log("\n⚠ DRY-RUN — ຍັງບໍ່ໄດ້ຂຽນຫຍັງລົງ DB. ໃສ່ --apply ຈຶ່ງຂຽນແທ້");
    return;
  }

  const res = await applyVehicleSync(plan);
  console.log(`\n✓ ເພີ່ມແລ້ວ ${res.inserted} ແຖວ · ແກ້ແລ້ວ ${res.updated} ແຖວ`);
  if (res.conflicts) console.log(`  (${res.conflicts} ແຖວຖືກຂ້າມ ເພາະ IMEI ມີຢູ່ແລ້ວ)`);
}

main()
  .catch((e) => {
    console.error(`\n✗ ຜິດພາດ: ${laoGpsErrorMessage(e)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
