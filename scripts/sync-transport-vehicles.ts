/**
 * ແບ່ງປະເພດລົດ TMS ຕາມຂໍ້ມູນຖ້ຽວ:
 * - ມີ transaction ຖ້ຽວໃນ `odg_tms_trip_distance` → ພະແນກຂົນສົ່ງ (502)
 * - ບໍ່ມີຖ້ຽວ → ລົດຊ່າງ/ພະແນກຕິດຕັ້ງໂຄງການ (403)
 * - ລົດຂົນສົ່ງ → ສາຂາຂົນສົ່ງ (TRANSPORT)
 *
 * ຈັບຄູ່ລົດ HRM ↔ TMS ດ້ວຍເລກທະບຽນກ່ອນ ແລ້ວຈຶ່ງ fallback ຫາ IMEI.
 * ເປັນ dry-run ໂດຍ default; ຕ້ອງໃສ່ `--apply` ຈຶ່ງຈະຂຽນ DB.
 *
 *   npm run fleet:sync-transport
 *   npm run fleet:sync-transport -- --apply
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const TRANSPORT_DEPARTMENT_CODE = "502";
const TECHNICIAN_DEPARTMENT_CODE = "403";
const TRANSPORT_BRANCH_CODE = "TRANSPORT";
const apply = process.argv.slice(2).includes("--apply");

type Candidate = {
  id: bigint;
  plate_no: string | null;
  vehicle_name: string | null;
  old_department_code: string | null;
  tms_code: string | null;
  tms_name: string | null;
  matched_by: "IMEI" | "plate";
  trip_count: number;
  target_department_code: string;
};

async function main() {
  const departments = await prisma.$queryRawUnsafe<
    Array<{ code: string; name: string | null }>
  >(
    `SELECT department_code AS code, department_name_lo AS name
       FROM odg_department
      WHERE department_code = ANY($1::text[])
      ORDER BY department_code`,
    [TRANSPORT_DEPARTMENT_CODE, TECHNICIAN_DEPARTMENT_CODE],
  );

  if (departments.length !== 2) {
    throw new Error(
      `ຕ້ອງມີພະແນກ ${TRANSPORT_DEPARTMENT_CODE} ແລະ ${TECHNICIAN_DEPARTMENT_CODE}`,
    );
  }

  const departmentNames = new Map(departments.map((department) => [department.code, department.name]));
  const candidates = await prisma.$queryRawUnsafe<Candidate[]>(
    `SELECT v.id,
            v.plate_no,
            v.name AS vehicle_name,
            v.department_code AS old_department_code,
            match.tms_code,
            match.tms_name,
            match.matched_by,
            match.trip_count,
            CASE WHEN match.trip_count > 0 THEN $1 ELSE $2 END AS target_department_code
       FROM app_car_vehicles v
       CROSS JOIN LATERAL (
         SELECT t.code AS tms_code,
                t.name_1 AS tms_name,
                CASE WHEN
                  regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g')
                  IN (
                    regexp_replace(lower(COALESCE(t.plate_no, '')), '[[:space:]-]+', '', 'g'),
                    regexp_replace(lower(COALESCE(t.name_1, '')), '[[:space:]-]+', '', 'g')
                  )
                THEN 'plate' ELSE 'IMEI' END AS matched_by,
                (
                  SELECT COUNT(*)::int
                    FROM odg_tms_trip_distance trip
                   WHERE NULLIF(
                           regexp_replace(lower(COALESCE(trip.car_code, '')), '[[:space:]-]+', '', 'g'),
                           ''
                         ) IS NOT NULL
                     AND regexp_replace(lower(COALESCE(trip.car_code, '')), '[[:space:]-]+', '', 'g')
                         IN (
                           regexp_replace(lower(COALESCE(t.code, '')), '[[:space:]-]+', '', 'g'),
                           regexp_replace(lower(COALESCE(t.plate_no, '')), '[[:space:]-]+', '', 'g'),
                           regexp_replace(lower(COALESCE(t.name_1, '')), '[[:space:]-]+', '', 'g')
                         )
                ) AS trip_count
           FROM odg_tms_car t
          WHERE (
                  NULLIF(regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g'), '') IS NOT NULL
              AND regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g')
                  IN (
                    regexp_replace(lower(COALESCE(t.plate_no, '')), '[[:space:]-]+', '', 'g'),
                    regexp_replace(lower(COALESCE(t.name_1, '')), '[[:space:]-]+', '', 'g')
                  )
                )
             OR (
                  NULLIF(BTRIM(v.gps_imei), '') IS NOT NULL
              AND NULLIF(BTRIM(t.imei), '') IS NOT NULL
              AND BTRIM(v.gps_imei) = BTRIM(t.imei)
                )
          ORDER BY CASE WHEN
                     regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g')
                     IN (
                       regexp_replace(lower(COALESCE(t.plate_no, '')), '[[:space:]-]+', '', 'g'),
                       regexp_replace(lower(COALESCE(t.name_1, '')), '[[:space:]-]+', '', 'g')
                     )
                   THEN 0 ELSE 1 END
          LIMIT 1
       ) match
      ORDER BY v.plate_no NULLS LAST, v.id`,
    TRANSPORT_DEPARTMENT_CODE,
    TECHNICIAN_DEPARTMENT_CODE,
  );

  const pending = candidates.filter(
    (vehicle) => vehicle.old_department_code !== vehicle.target_department_code,
  );
  const transport = candidates.filter(
    (vehicle) => vehicle.target_department_code === TRANSPORT_DEPARTMENT_CODE,
  );
  const technician = candidates.filter(
    (vehicle) => vehicle.target_department_code === TECHNICIAN_DEPARTMENT_CODE,
  );
  const profiles = await prisma.vehicleProfile.findMany({
    where: { vehicleId: { in: candidates.map((vehicle) => vehicle.id) } },
  });
  const currentBranch = new Map(
    profiles.map((profile) => [profile.vehicleId.toString(), profile.branchCode]),
  );
  const branchUpdates = transport
    .map((vehicle) => ({
      vehicle,
      branchCode: TRANSPORT_BRANCH_CODE,
    }))
    .filter(
      (item): item is { vehicle: Candidate; branchCode: string } =>
        Boolean(item.branchCode) && currentBranch.get(item.vehicle.id.toString()) !== item.branchCode,
    );

  console.log(
    `ລົດ TMS ${candidates.length} ຄັນ · ຂົນສົ່ງ ${transport.length} ຄັນ · ` +
      `ລົດຊ່າງ ${technician.length} ຄັນ · ພະແນກຕ້ອງອັບເດດ ${pending.length} ຄັນ · ` +
      `ສາຂາຕ້ອງອັບເດດ ${branchUpdates.length} ຄັນ`,
  );

  for (const vehicle of candidates) {
    const current = vehicle.old_department_code ?? "-";
    const target = vehicle.target_department_code;
    const status = current === target ? "=" : "→";
    const type = target === TRANSPORT_DEPARTMENT_CODE ? "ຂົນສົ່ງ" : "ລົດຊ່າງ";
    const targetBranch = target === TRANSPORT_DEPARTMENT_CODE ? TRANSPORT_BRANCH_CODE : null;
    const branchLabel = targetBranch
      ? ` · ສາຂາ ${currentBranch.get(vehicle.id.toString()) ?? "-"} → ${targetBranch}`
      : "";
    console.log(
      `  ${status} ${vehicle.plate_no ?? vehicle.vehicle_name ?? `id=${vehicle.id}`}  ` +
        `${current} → ${target} ${type} · ${vehicle.trip_count} ຖ້ຽວ ` +
        `(${vehicle.matched_by}: ${vehicle.tms_name ?? vehicle.tms_code ?? "-"})${branchLabel}`,
    );
  }

  if (!apply) {
    console.log("\n⚠ DRY-RUN — ຍັງບໍ່ໄດ້ຂຽນ DB. ໃສ່ --apply ເພື່ອອັບເດດແທ້");
    return;
  }

  const updated = await prisma.$executeRawUnsafe(
    `WITH classified AS (
       SELECT v.id,
              CASE WHEN EXISTS (
                SELECT 1
                  FROM odg_tms_trip_distance trip
                 WHERE NULLIF(
                         regexp_replace(lower(COALESCE(trip.car_code, '')), '[[:space:]-]+', '', 'g'),
                         ''
                       ) IS NOT NULL
                   AND regexp_replace(lower(COALESCE(trip.car_code, '')), '[[:space:]-]+', '', 'g')
                       IN (
                         regexp_replace(lower(COALESCE(match.tms_code, '')), '[[:space:]-]+', '', 'g'),
                         regexp_replace(lower(COALESCE(match.tms_plate, '')), '[[:space:]-]+', '', 'g'),
                         regexp_replace(lower(COALESCE(match.tms_name, '')), '[[:space:]-]+', '', 'g')
                       )
              ) THEN $1 ELSE $2 END AS target_department_code
         FROM app_car_vehicles v
         CROSS JOIN LATERAL (
           SELECT t.code AS tms_code, t.plate_no AS tms_plate, t.name_1 AS tms_name
             FROM odg_tms_car t
            WHERE (
                    NULLIF(regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g'), '') IS NOT NULL
                AND regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g')
                    IN (
                      regexp_replace(lower(COALESCE(t.plate_no, '')), '[[:space:]-]+', '', 'g'),
                      regexp_replace(lower(COALESCE(t.name_1, '')), '[[:space:]-]+', '', 'g')
                    )
                  )
               OR (
                    NULLIF(BTRIM(v.gps_imei), '') IS NOT NULL
                AND NULLIF(BTRIM(t.imei), '') IS NOT NULL
                AND BTRIM(v.gps_imei) = BTRIM(t.imei)
                  )
            ORDER BY CASE WHEN
                       regexp_replace(lower(COALESCE(v.plate_no, '')), '[[:space:]-]+', '', 'g')
                       IN (
                         regexp_replace(lower(COALESCE(t.plate_no, '')), '[[:space:]-]+', '', 'g'),
                         regexp_replace(lower(COALESCE(t.name_1, '')), '[[:space:]-]+', '', 'g')
                       )
                     THEN 0 ELSE 1 END
            LIMIT 1
         ) match
     )
     UPDATE app_car_vehicles vehicle
        SET department_code = classified.target_department_code,
            updated_at = NOW()
       FROM classified
      WHERE vehicle.id = classified.id
        AND vehicle.department_code IS DISTINCT FROM classified.target_department_code`,
    TRANSPORT_DEPARTMENT_CODE,
    TECHNICIAN_DEPARTMENT_CODE,
  );

  if (branchUpdates.length) {
    await prisma.$transaction(
      branchUpdates.map(({ vehicle, branchCode }) =>
        prisma.vehicleProfile.upsert({
          where: { vehicleId: vehicle.id },
          create: { vehicleId: vehicle.id, branchCode },
          update: { branchCode },
        }),
      ),
    );
  }

  console.log(`\n✓ ອັບເດດພະແນກ ${updated} ຄັນ · ອັບເດດສາຂາ ${branchUpdates.length} ຄັນ`);
  console.log(
    `  ${TRANSPORT_DEPARTMENT_CODE}: ${departmentNames.get(TRANSPORT_DEPARTMENT_CODE)} · ` +
      `${TECHNICIAN_DEPARTMENT_CODE}: ${departmentNames.get(TECHNICIAN_DEPARTMENT_CODE)}`,
  );
}

main()
  .catch((error) => {
    console.error("\n✗ ຜິດພາດ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
