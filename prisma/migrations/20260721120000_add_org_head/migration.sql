-- ══════════════════════════════════════════════════════════════
-- ຫົວໜ້າຂອງໜ່ວຍໂຄງສ້າງ (ຝ່າຍ/ພະແນກ/ໜ່ວຍງານ) — ຕາຕະລາງ hrm_org_head
-- ເພີ່ມຢ່າງດຽວ (additive) · PK (scope, code) = 1 ໜ່ວຍ ມີຫົວໜ້າ 1 ຄົນ
-- (employee_code ຊ້ຳໄດ້ → 1 ຄົນ ເປັນຫົວໜ້າໄດ້ຫຼາຍໜ່ວຍ)
-- ══════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "OrgScope" AS ENUM ('DIVISION', 'DEPARTMENT', 'UNIT');

-- CreateTable
CREATE TABLE "hrm_org_head" (
    "scope" "OrgScope" NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,
    "assigned_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_org_head_pkey" PRIMARY KEY ("scope", "code")
);

-- CreateIndex
CREATE INDEX "hrm_org_head_employee_code_idx" ON "hrm_org_head"("employee_code");

-- AddForeignKey
ALTER TABLE "hrm_org_head" ADD CONSTRAINT "hrm_org_head_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;
