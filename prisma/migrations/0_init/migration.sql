-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "HrStatus" AS ENUM ('PROBATION', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PROBATION', 'FIXED_TERM', 'PERMANENT', 'PART_TIME', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayItemKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "KpiCategory" AS ENUM ('RESULT', 'QUALITY', 'TIME', 'BEHAVIOR');

-- CreateEnum
CREATE TYPE "KpiLevel" AS ENUM ('COMPANY', 'DEPARTMENT', 'POSITION', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "KpiFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CyclePeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'PROBATION_30D', 'PROBATION_60D', 'PROBATION_90D', 'PROBATION_120D', 'PROJECT', 'POST_TRAINING');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CALIBRATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SUBMITTED', 'MANAGER_REVIEWED', 'SECOND_LEVEL_REVIEWED', 'HR_REVIEWED', 'APPROVED', 'RESULT_ACKNOWLEDGED', 'CLOSED', 'APPEALED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RaterType" AS ENUM ('SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'INTERNAL_CUSTOMER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "DevPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PROMOTION', 'TRANSFER_DEPT', 'TRANSFER_UNIT', 'SALARY_ADJUST', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('COMPUTER', 'NOTEBOOK', 'PHONE', 'SIM_CARD', 'VEHICLE', 'UNIFORM', 'OTHER');

-- CreateTable
CREATE TABLE "odg_division" (
    "division_code" VARCHAR(20) NOT NULL,
    "division_name_lo" VARCHAR(200) NOT NULL,
    "division_name_en" VARCHAR(200),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odg_division_pkey" PRIMARY KEY ("division_code")
);

-- CreateTable
CREATE TABLE "odg_department" (
    "department_code" VARCHAR(20) NOT NULL,
    "department_name_lo" VARCHAR(200) NOT NULL,
    "department_name_en" VARCHAR(200),
    "division_code" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odg_department_pkey" PRIMARY KEY ("department_code")
);

-- CreateTable
CREATE TABLE "odg_unit" (
    "unit_code" VARCHAR(20) NOT NULL,
    "unit_name_lo" VARCHAR(200) NOT NULL,
    "unit_name_en" VARCHAR(200),
    "department_code" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odg_unit_pkey" PRIMARY KEY ("unit_code")
);

-- CreateTable
CREATE TABLE "odg_position" (
    "position_code" VARCHAR(20) NOT NULL,
    "position_name_lo" VARCHAR(200) NOT NULL,
    "position_name_en" VARCHAR(200),
    "is_manager" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odg_position_pkey" PRIMARY KEY ("position_code")
);

-- CreateTable
CREATE TABLE "odg_employee" (
    "employee_id" SERIAL NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,
    "title_lo" VARCHAR(50),
    "fullname_lo" VARCHAR(200) NOT NULL,
    "nickname" VARCHAR(50),
    "title_en" VARCHAR(20),
    "fullname_en" VARCHAR(200),
    "position_code" VARCHAR(20),
    "division_code" VARCHAR(20),
    "department_code" VARCHAR(20),
    "unit_code" VARCHAR(20),
    "hire_date" DATE,
    "employment_status" VARCHAR(20) DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "line_id" TEXT,
    "password" TEXT,
    "app_role" VARCHAR(20),
    "pos_pin_hash" VARCHAR(200),
    "mobile" TEXT,

    CONSTRAINT "odg_employee_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "hrm_employee_profile" (
    "employee_code" VARCHAR(20) NOT NULL,
    "gender" "Gender",
    "dob" DATE,
    "national_id" TEXT,
    "marital_status" "MaritalStatus",
    "email" TEXT,
    "address" TEXT,
    "photo_url" TEXT,
    "probation_end_date" DATE,
    "resign_date" DATE,
    "hr_status" "HrStatus" NOT NULL DEFAULT 'ACTIVE',
    "base_salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "position_allowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "social_security_no" TEXT,
    "tax_id" TEXT,
    "manager_code" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_employee_profile_pkey" PRIMARY KEY ("employee_code")
);

-- CreateTable
CREATE TABLE "hrm_user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "employee_code" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_contract" (
    "id" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "salary" DECIMAL(14,2) NOT NULL,
    "file_url" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "employee_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_employee_document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "file_url" TEXT NOT NULL,
    "expiry_date" DATE,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employee_code" VARCHAR(20) NOT NULL,

    CONSTRAINT "hrm_employee_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_approval_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_role" "Role" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_approval_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "detail" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_leave_type" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days_per_year" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hrm_leave_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_leave_balance" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carried_over" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employee_code" VARCHAR(20) NOT NULL,
    "leave_type_id" TEXT NOT NULL,

    CONSTRAINT "hrm_leave_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_leave_request" (
    "id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "proof_url" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
    "reject_reason" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_leave_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_overtime_request" (
    "id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
    "reject_reason" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_overtime_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_payroll_period" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "pay_date" DATE,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_payroll_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_payslip" (
    "id" TEXT NOT NULL,
    "base_salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "position_allowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ot_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "other_earnings" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "social_security" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "income_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "late_deduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "absent_deduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gross_pay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "period_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_payslip_item" (
    "id" TEXT NOT NULL,
    "kind" "PayItemKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payslip_id" TEXT NOT NULL,

    CONSTRAINT "hrm_payslip_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_kpi" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "KpiCategory" NOT NULL,
    "level" "KpiLevel" NOT NULL DEFAULT 'INDIVIDUAL',
    "unit" TEXT NOT NULL,
    "direction" "KpiDirection" NOT NULL DEFAULT 'HIGHER_BETTER',
    "frequency" "KpiFrequency" NOT NULL DEFAULT 'MONTHLY',
    "data_source" TEXT,
    "max_achievement" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_company_kpi_target" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "actual" DOUBLE PRECISION,
    "kpi_id" TEXT NOT NULL,

    CONSTRAINT "hrm_company_kpi_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_kpi_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "KpiLevel" NOT NULL,
    "year" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "department_code" VARCHAR(20),
    "position_code" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_kpi_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_kpi_template_item" (
    "id" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "template_id" TEXT NOT NULL,
    "kpi_id" TEXT NOT NULL,

    CONSTRAINT "hrm_kpi_template_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_grade_scale" (
    "id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "min_score" DOUBLE PRECISION NOT NULL,
    "max_score" DOUBLE PRECISION NOT NULL,
    "meaning" TEXT NOT NULL,
    "bonus_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "hrm_grade_scale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_evaluation_cycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" "CyclePeriodType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "quarter" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_evaluation_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_evaluation" (
    "id" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "self_score" DOUBLE PRECISION,
    "manager_score" DOUBLE PRECISION,
    "second_level_score" DOUBLE PRECISION,
    "final_score" DOUBLE PRECISION,
    "grade" TEXT,
    "bonus_factor" DOUBLE PRECISION,
    "bonus_amount" DECIMAL(14,2),
    "self_comment" TEXT,
    "manager_comment" TEXT,
    "hr_comment" TEXT,
    "appeal_reason" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "manager_reviewed_at" TIMESTAMP(3),
    "hr_reviewed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "result_acknowledged_at" TIMESTAMP(3),
    "employee_code" VARCHAR(20) NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_evaluation_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "KpiCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" "KpiDirection" NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "actual" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION NOT NULL,
    "max_achievement" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "achievement" DOUBLE PRECISION,
    "weighted_score" DOUBLE PRECISION,
    "self_score" DOUBLE PRECISION,
    "manager_score" DOUBLE PRECISION,
    "final_score" DOUBLE PRECISION,
    "comment" TEXT,
    "evaluation_id" TEXT NOT NULL,
    "kpi_id" TEXT,

    CONSTRAINT "hrm_evaluation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_evidence" (
    "id" TEXT NOT NULL,
    "file_url" TEXT,
    "link_url" TEXT,
    "ref_no" TEXT,
    "description" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "item_id" TEXT NOT NULL,

    CONSTRAINT "hrm_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_feedback_360" (
    "id" TEXT NOT NULL,
    "rater_type" "RaterType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "comment" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluation_id" TEXT NOT NULL,
    "rater_code" VARCHAR(20),

    CONSTRAINT "hrm_feedback_360_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_score_change_log" (
    "id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" DOUBLE PRECISION,
    "new_value" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluation_id" TEXT NOT NULL,

    CONSTRAINT "hrm_score_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_development_plan" (
    "id" TEXT NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "status" "DevPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "employee_code" VARCHAR(20) NOT NULL,
    "evaluation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_development_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_development_plan_item" (
    "id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "due_date" DATE,
    "status" "DevPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "result" TEXT,
    "plan_id" TEXT NOT NULL,

    CONSTRAINT "hrm_development_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_employee_movement" (
    "id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "effective_date" DATE NOT NULL,
    "from_position_code" VARCHAR(20),
    "to_position_code" VARCHAR(20),
    "from_department_code" VARCHAR(20),
    "to_department_code" VARCHAR(20),
    "from_unit_code" VARCHAR(20),
    "to_unit_code" VARCHAR(20),
    "from_salary" DECIMAL(14,2),
    "to_salary" DECIMAL(14,2),
    "from_status" "HrStatus",
    "to_status" "HrStatus",
    "reason" TEXT,
    "approved_by_user_id" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_employee_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "serial_number" TEXT,
    "value" DECIMAL(14,2),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_asset_assignment" (
    "id" TEXT NOT NULL,
    "assigned_date" DATE NOT NULL,
    "returned_date" DATE,
    "condition" TEXT,
    "note" TEXT,
    "asset_id" TEXT NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,

    CONSTRAINT "hrm_asset_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "odg_employee_employee_code_key" ON "odg_employee"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_employee_profile_manager_code_idx" ON "hrm_employee_profile"("manager_code");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_user_username_key" ON "hrm_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_user_email_key" ON "hrm_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_user_employee_code_key" ON "hrm_user"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_contract_contract_no_key" ON "hrm_contract"("contract_no");

-- CreateIndex
CREATE INDEX "hrm_contract_employee_code_idx" ON "hrm_contract"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_contract_end_date_idx" ON "hrm_contract"("end_date");

-- CreateIndex
CREATE INDEX "hrm_employee_document_employee_code_idx" ON "hrm_employee_document"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_approval_log_entity_type_entity_id_idx" ON "hrm_approval_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "hrm_audit_log_entity_type_entity_id_idx" ON "hrm_audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "hrm_audit_log_user_id_idx" ON "hrm_audit_log"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_leave_type_code_key" ON "hrm_leave_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_leave_balance_employee_code_leave_type_id_year_key" ON "hrm_leave_balance"("employee_code", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "hrm_leave_request_employee_code_idx" ON "hrm_leave_request"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_leave_request_status_idx" ON "hrm_leave_request"("status");

-- CreateIndex
CREATE INDEX "hrm_overtime_request_employee_code_idx" ON "hrm_overtime_request"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_overtime_request_status_idx" ON "hrm_overtime_request"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_payroll_period_year_month_key" ON "hrm_payroll_period"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_payslip_employee_code_period_id_key" ON "hrm_payslip"("employee_code", "period_id");

-- CreateIndex
CREATE INDEX "hrm_payslip_item_payslip_id_idx" ON "hrm_payslip_item"("payslip_id");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_kpi_code_key" ON "hrm_kpi"("code");

-- CreateIndex
CREATE INDEX "hrm_kpi_category_idx" ON "hrm_kpi"("category");

-- CreateIndex
CREATE INDEX "hrm_kpi_level_idx" ON "hrm_kpi"("level");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_company_kpi_target_kpi_id_year_key" ON "hrm_company_kpi_target"("kpi_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_kpi_template_item_template_id_kpi_id_key" ON "hrm_kpi_template_item"("template_id", "kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_grade_scale_grade_key" ON "hrm_grade_scale"("grade");

-- CreateIndex
CREATE INDEX "hrm_evaluation_status_idx" ON "hrm_evaluation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_evaluation_employee_code_cycle_id_key" ON "hrm_evaluation"("employee_code", "cycle_id");

-- CreateIndex
CREATE INDEX "hrm_evaluation_item_evaluation_id_idx" ON "hrm_evaluation_item"("evaluation_id");

-- CreateIndex
CREATE INDEX "hrm_evidence_item_id_idx" ON "hrm_evidence"("item_id");

-- CreateIndex
CREATE INDEX "hrm_feedback_360_evaluation_id_idx" ON "hrm_feedback_360"("evaluation_id");

-- CreateIndex
CREATE INDEX "hrm_score_change_log_evaluation_id_idx" ON "hrm_score_change_log"("evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_development_plan_evaluation_id_key" ON "hrm_development_plan"("evaluation_id");

-- CreateIndex
CREATE INDEX "hrm_development_plan_employee_code_idx" ON "hrm_development_plan"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_development_plan_item_plan_id_idx" ON "hrm_development_plan_item"("plan_id");

-- CreateIndex
CREATE INDEX "hrm_employee_movement_employee_code_idx" ON "hrm_employee_movement"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_asset_code_key" ON "hrm_asset"("code");

-- CreateIndex
CREATE INDEX "hrm_asset_assignment_employee_code_idx" ON "hrm_asset_assignment"("employee_code");

-- CreateIndex
CREATE INDEX "hrm_asset_assignment_asset_id_idx" ON "hrm_asset_assignment"("asset_id");

-- AddForeignKey
ALTER TABLE "odg_department" ADD CONSTRAINT "fk_department_division" FOREIGN KEY ("division_code") REFERENCES "odg_division"("division_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odg_unit" ADD CONSTRAINT "fk_unit_department" FOREIGN KEY ("department_code") REFERENCES "odg_department"("department_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_employee_profile" ADD CONSTRAINT "hrm_employee_profile_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_employee_profile" ADD CONSTRAINT "hrm_employee_profile_manager_code_fkey" FOREIGN KEY ("manager_code") REFERENCES "odg_employee"("employee_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_user" ADD CONSTRAINT "hrm_user_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_contract" ADD CONSTRAINT "hrm_contract_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_employee_document" ADD CONSTRAINT "hrm_employee_document_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_balance" ADD CONSTRAINT "hrm_leave_balance_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_balance" ADD CONSTRAINT "hrm_leave_balance_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hrm_leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_request" ADD CONSTRAINT "hrm_leave_request_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_leave_request" ADD CONSTRAINT "hrm_leave_request_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hrm_leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_overtime_request" ADD CONSTRAINT "hrm_overtime_request_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_payslip" ADD CONSTRAINT "hrm_payslip_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_payslip" ADD CONSTRAINT "hrm_payslip_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "hrm_payroll_period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_payslip_item" ADD CONSTRAINT "hrm_payslip_item_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "hrm_payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_company_kpi_target" ADD CONSTRAINT "hrm_company_kpi_target_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "hrm_kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_kpi_template" ADD CONSTRAINT "hrm_kpi_template_department_code_fkey" FOREIGN KEY ("department_code") REFERENCES "odg_department"("department_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_kpi_template" ADD CONSTRAINT "hrm_kpi_template_position_code_fkey" FOREIGN KEY ("position_code") REFERENCES "odg_position"("position_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_kpi_template_item" ADD CONSTRAINT "hrm_kpi_template_item_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hrm_kpi_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_kpi_template_item" ADD CONSTRAINT "hrm_kpi_template_item_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "hrm_kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_evaluation" ADD CONSTRAINT "hrm_evaluation_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_evaluation" ADD CONSTRAINT "hrm_evaluation_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "hrm_evaluation_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_evaluation" ADD CONSTRAINT "hrm_evaluation_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hrm_kpi_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_evaluation_item" ADD CONSTRAINT "hrm_evaluation_item_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "hrm_evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_evaluation_item" ADD CONSTRAINT "hrm_evaluation_item_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "hrm_kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_evidence" ADD CONSTRAINT "hrm_evidence_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "hrm_evaluation_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_feedback_360" ADD CONSTRAINT "hrm_feedback_360_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "hrm_evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_feedback_360" ADD CONSTRAINT "hrm_feedback_360_rater_code_fkey" FOREIGN KEY ("rater_code") REFERENCES "odg_employee"("employee_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_score_change_log" ADD CONSTRAINT "hrm_score_change_log_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "hrm_evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_development_plan" ADD CONSTRAINT "hrm_development_plan_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_development_plan" ADD CONSTRAINT "hrm_development_plan_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "hrm_evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_development_plan_item" ADD CONSTRAINT "hrm_development_plan_item_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "hrm_development_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_employee_movement" ADD CONSTRAINT "hrm_employee_movement_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_asset_assignment" ADD CONSTRAINT "hrm_asset_assignment_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "hrm_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_asset_assignment" ADD CONSTRAINT "hrm_asset_assignment_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;

