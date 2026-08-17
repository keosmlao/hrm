-- AlterTable
ALTER TABLE "hrm_evaluation" ADD COLUMN "evaluator_code" VARCHAR(20);

-- CreateIndex
CREATE INDEX "hrm_evaluation_evaluator_code_idx" ON "hrm_evaluation"("evaluator_code");

-- AddForeignKey
ALTER TABLE "hrm_evaluation" ADD CONSTRAINT "hrm_evaluation_evaluator_code_fkey" FOREIGN KEY ("evaluator_code") REFERENCES "odg_employee"("employee_code") ON DELETE SET NULL ON UPDATE CASCADE;
