-- ຄຳຮ້ອງຂໍ trip ຈາກພະນັກງານ (LINE) + ຂັ້ນຕອນອະນຸມັດ.
-- ບໍ່ໃຊ້ enum ໃໝ່ (PG11 ຫ້າມ ALTER TYPE ADD VALUE ໃນ transaction) → ໃຊ້ approved_at ເປັນ gate.

-- ຕອນຮ້ອງຂໍ ຍັງບໍ່ໄດ້ຈັດລົດ → vehicle_id ວ່າງໄດ້
ALTER TABLE "hrm_vehicle_trip" ALTER COLUMN "vehicle_id" DROP NOT NULL;

-- ຜູ້ຮ້ອງຂໍ + ສະຖານະການອະນຸມັດ
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "requested_by_code" VARCHAR(20);
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "approved_by_user_id" TEXT;
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "reject_reason" TEXT;

ALTER TABLE "hrm_vehicle_trip"
  ADD CONSTRAINT "hrm_vehicle_trip_requested_by_code_fkey"
  FOREIGN KEY ("requested_by_code") REFERENCES "odg_employee"("employee_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hrm_vehicle_trip_requested_by_code_idx" ON "hrm_vehicle_trip"("requested_by_code");
CREATE INDEX "hrm_vehicle_trip_approved_at_idx" ON "hrm_vehicle_trip"("approved_at");

-- trip ທີ່ມີຢູ່ກ່ອນ ຖືວ່າ admin ສ້າງ + ອະນຸມັດແລ້ວ
UPDATE "hrm_vehicle_trip" SET "approved_at" = "created_at" WHERE "approved_at" IS NULL;
