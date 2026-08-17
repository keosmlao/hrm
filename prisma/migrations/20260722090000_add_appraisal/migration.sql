-- ══════════════════════════════════════════════════════════════
-- ປະເມີນຜົນງານ (ແບບງ່າຍ) — hrm_appraisal_cycle + hrm_appraisal
-- ເພີ່ມຢ່າງດຽວ (additive) · ບໍ່ແຕະ odg_* ຫຼືຕາຕະລາງ hrm_* ອື່ນ
-- ══════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "AppraisalStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "hrm_appraisal_cycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_appraisal_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_appraisal" (
    "id" TEXT NOT NULL,
    "status" "AppraisalStatus" NOT NULL DEFAULT 'PENDING',
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "comment" TEXT,
    "evaluated_at" TIMESTAMP(3),
    "cycle_id" TEXT NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,
    "evaluator_code" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_appraisal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_appraisal_cycle_id_employee_code_key" ON "hrm_appraisal"("cycle_id", "employee_code");

-- CreateIndex
CREATE INDEX "hrm_appraisal_evaluator_code_idx" ON "hrm_appraisal"("evaluator_code");

-- AddForeignKey
ALTER TABLE "hrm_appraisal" ADD CONSTRAINT "hrm_appraisal_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "hrm_appraisal_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_appraisal" ADD CONSTRAINT "hrm_appraisal_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_appraisal" ADD CONSTRAINT "hrm_appraisal_evaluator_code_fkey" FOREIGN KEY ("evaluator_code") REFERENCES "odg_employee"("employee_code") ON DELETE SET NULL ON UPDATE CASCADE;
