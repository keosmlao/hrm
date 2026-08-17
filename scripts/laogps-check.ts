/**
 * ທົດລອງດຶງຂໍ້ມູນ GPS ຈາກ Lao GPS Open API — ຢືນຢັນວ່າ credentials ໃນ .env ໃຊ້ໄດ້
 * ແລະ ຈັບຄູ່ IMEI ຂອງລົດໃນ HRM ກັບບັນຊີ LaoGPS ໄດ້ຄົບບໍ.
 *
 *   npm run gps:check              # ວັນນີ້
 *   npm run gps:check 2026-08-01 2026-08-07
 */
import "dotenv/config";
import {
  getDriverBehaviour,
  getFuel,
  getHistory,
  laoGpsConfigured,
  laoGpsErrorMessage,
  listVehicles,
  listPositions,
  me,
} from "../src/lib/laogps";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

const from = process.argv[2] ?? today();
const to = process.argv[3] ?? from;

async function main() {
  if (!laoGpsConfigured()) {
    console.error("✗ ຍັງບໍ່ໄດ້ຕັ້ງ GPS_OPENAPI_USER / GPS_OPENAPI_PASS ໃນ .env");
    process.exit(1);
  }

  const who = await me();
  console.log(`✓ login ສຳເລັດ — ບັນຊີ ${who.username} (user_id ${who.user_id}), token ໝົດອາຍຸ ${who.token.expires_at}`);

  const vehicles = await listVehicles({ limit: 2000 });
  console.log(`\n✓ ລົດໃນບັນຊີ LaoGPS: ${vehicles.length} ຄັນ`);
  for (const v of vehicles.slice(0, 10)) {
    const cap = v.fuel_capability;
    console.log(
      `   ${String(v.vehicle_id).padEnd(6)} ${(v.plate ?? v.name ?? "-").padEnd(14)} imei=${v.imei}` +
        `  ນ້ຳມັນ=${cap.supported ? cap.method : `ບໍ່ໄດ້ (${cap.reason})`}` +
        `  ລ່າສຸດ=${v.last_seen_at ?? "-"}`,
    );
  }
  if (vehicles.length > 10) console.log(`   … ອີກ ${vehicles.length - 10} ຄັນ`);

  // ຈັບຄູ່ກັບລົດໃນ HRM ຜ່ານ IMEI
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const hrm = await prisma.carVehicle.findMany({ select: { plateNo: true, gpsImei: true } });
    const withImei = hrm.filter((v) => v.gpsImei?.trim());
    const apiImei = new Set(vehicles.map((v) => v.imei.trim()));
    const missing = withImei.filter((v) => !apiImei.has(v.gpsImei!.trim()));
    console.log(
      `\n✓ ຈັບຄູ່ IMEI: HRM ມີລົດ ${hrm.length} ຄັນ, ຕັ້ງ IMEI ແລ້ວ ${withImei.length} ຄັນ, ` +
        `ບໍ່ພົບໃນ LaoGPS ${missing.length} ຄັນ`,
    );
    for (const v of missing) console.log(`   ✗ ${v.plateNo ?? "-"} imei=${v.gpsImei}`);
  } finally {
    await prisma.$disconnect();
  }

  const positions = await listPositions({ activeOnly: true });
  const live = positions.filter((p) => p.source === "live").length;
  console.log(`\n✓ ຕຳແໜ່ງລ່າສຸດ: ${positions.length} ຄັນ (realtime ${live}, cached ${positions.length - live})`);

  const sample = vehicles.find((v) => v.fuel_capability.supported) ?? vehicles[0];
  if (!sample) {
    console.log("\n(ບໍ່ມີລົດໃຫ້ທົດລອງ history/fuel/driver-behaviour)");
    return;
  }
  const label = sample.plate ?? sample.name ?? String(sample.vehicle_id);
  console.log(`\n── ທົດລອງ ${label} (${from} → ${to}) ──`);

  const { data: h, meta } = await getHistory(sample.vehicle_id, { from, to, includePoints: false });
  console.log(
    `history: ${h.summary.points} ຈຸດ, ${h.summary.trips} ຖ້ຽວ, ${h.summary.distance_km} ກມ, ` +
      `ສູງສຸດ ${h.summary.max_speed_kmh} ກມ/ຊມ, ນ້ຳມັນ ${h.fuel.used_litre ?? `null (${h.fuel.reason})`} L` +
      (meta.truncated ? `  ⚠ ຖືກຕັດ — next_from=${meta.next_from}` : ""),
  );

  const f = await getFuel(sample.vehicle_id, { from, to, daily: true });
  console.log(
    `fuel:    ${f.fuel_used_litre ?? `null (${f.fuel_reason})`} L` +
      (f.fuel_used_litre_daily_sum != null ? ` · ລວມລາຍວັນ ${f.fuel_used_litre_daily_sum} L` : "") +
      ` · method=${f.fuel_method} · ${f.sample_count} ຄ່າ`,
  );

  const d = await getDriverBehaviour(sample.vehicle_id, { from, to });
  console.log(
    `driver:  safety ${d.safety_score} · eco ${d.eco_score} · overspeed ${d.overspeed_count} · ` +
      `dashcam ${d.dashcam_event_count} · ຈອດຕິດເຄື່ອງດົນ ${d.long_idle_hours} ຊມ`,
  );
}

main().catch((e) => {
  console.error(`\n✗ ຜິດພາດ: ${laoGpsErrorMessage(e)}`);
  process.exit(1);
});
