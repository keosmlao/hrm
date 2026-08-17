-- ══════════════════════════════════════════════════════════════
-- ລົງເວລາເຂົ້າ-ອອກ ຜ່ານ LINE mini app — ຕາຕະລາງ hrm_attendance
-- ເພີ່ມຢ່າງດຽວ (additive) — ບໍ່ແຕະ odg_* ຫຼືຕາຕະລາງ hrm_* ອື່ນ
-- ══════════════════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "hrm_attendance" (
    "id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "check_in_at" TIMESTAMP(6),
    "check_out_at" TIMESTAMP(6),
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER,
    "check_in_lat" DOUBLE PRECISION,
    "check_in_lng" DOUBLE PRECISION,
    "check_out_lat" DOUBLE PRECISION,
    "check_out_lng" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'LINE',
    "note" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_attendance_employee_code_work_date_key" ON "hrm_attendance"("employee_code", "work_date");

-- CreateIndex
CREATE INDEX "hrm_attendance_work_date_idx" ON "hrm_attendance"("work_date");

-- AddForeignKey
ALTER TABLE "hrm_attendance" ADD CONSTRAINT "hrm_attendance_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;
