-- ຜູ້ມີສິດອະນຸມັດ trip ຕໍ່ node (ຫຼາຍຄົນຕໍ່ node) — ໃຊ້ enum OrgScope ເດີມ
CREATE TABLE "hrm_trip_approver" (
  "scope" "OrgScope" NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "employee_code" VARCHAR(20) NOT NULL,
  "assigned_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_trip_approver_pkey" PRIMARY KEY ("scope", "code", "employee_code")
);

CREATE INDEX "hrm_trip_approver_employee_code_idx" ON "hrm_trip_approver"("employee_code");

ALTER TABLE "hrm_trip_approver"
  ADD CONSTRAINT "hrm_trip_approver_employee_code_fkey"
  FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code")
  ON DELETE CASCADE ON UPDATE CASCADE;
