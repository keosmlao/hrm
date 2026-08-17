-- ອະນຸມັດ "ລົດ" ຕ່າງຫາກ ຈາກ ອະນຸມັດ "ແຜນ" + ຜູ້ຢືມລົດ (additive ທັງໝົດ)
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "is_vehicle_borrower" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "vehicle_approved_at" TIMESTAMP(3);
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "vehicle_approved_by" VARCHAR(20);
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "vehicle_reject_reason" TEXT;

-- ຜູ້ມີສິດອະນຸມັດລົດ (global)
CREATE TABLE "hrm_vehicle_approver" (
  "employee_code" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_vehicle_approver_pkey" PRIMARY KEY ("employee_code")
);
ALTER TABLE "hrm_vehicle_approver"
  ADD CONSTRAINT "hrm_vehicle_approver_employee_code_fkey"
  FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code")
  ON DELETE CASCADE ON UPDATE CASCADE;
