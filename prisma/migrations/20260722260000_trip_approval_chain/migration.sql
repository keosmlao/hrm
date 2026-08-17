-- ຍົກເລີກ flat approver (ວ່າງ) → ໃຊ້ຂັ້ນຕອນອະນຸມັດຮຽງລຳດັບແທນ
DROP TABLE IF EXISTS "hrm_trip_approver";

-- ຂັ້ນຕອນອະນຸມັດ trip (global, ຮຽງລຳດັບ)
CREATE TABLE "hrm_trip_approval_step" (
  "id" TEXT NOT NULL,
  "step_order" INTEGER NOT NULL,
  "approver_type" TEXT NOT NULL,
  "specific_employee_code" VARCHAR(20),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_trip_approval_step_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hrm_trip_approval_step_step_order_key" ON "hrm_trip_approval_step"("step_order");
ALTER TABLE "hrm_trip_approval_step"
  ADD CONSTRAINT "hrm_trip_approval_step_specific_employee_code_fkey"
  FOREIGN KEY ("specific_employee_code") REFERENCES "odg_employee"("employee_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ຂັ້ນທີ່ຄຳຮ້ອງຜ່ານການອະນຸມັດແລ້ວ
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "approval_level" INTEGER NOT NULL DEFAULT 0;
