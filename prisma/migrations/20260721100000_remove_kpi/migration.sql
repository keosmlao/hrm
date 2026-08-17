-- ══════════════════════════════════════════════════════════════
-- ລົບໂມດູນ KPI / ການປະເມີນຜົນງານ ອອກທັງໝົດ (code + schema + tables)
-- ⚠️  ທຳລາຍຂໍ້ມູນ: ລົບຂໍ້ມູນ KPI/ການປະເມີນ/ແຜນພັດທະນາ ທັງໝົດຢ່າງຖາວອນ
-- ແຕະສະເພາະຕາຕະລາງ hrm_* ທີ່ HRM ສ້າງເອງ — ບໍ່ແຕະ odg_* ຫຼືຕາຕະລາງ hrm_* ອື່ນ
-- ══════════════════════════════════════════════════════════════

-- DropTable (CASCADE ເພື່ອລົບ FK ລະຫວ່າງຕາຕະລາງ KPI ນຳກັນ)
DROP TABLE IF EXISTS "hrm_development_plan_item" CASCADE;
DROP TABLE IF EXISTS "hrm_development_plan" CASCADE;
DROP TABLE IF EXISTS "hrm_score_change_log" CASCADE;
DROP TABLE IF EXISTS "hrm_feedback_360" CASCADE;
DROP TABLE IF EXISTS "hrm_evidence" CASCADE;
DROP TABLE IF EXISTS "hrm_evaluation_item" CASCADE;
DROP TABLE IF EXISTS "hrm_evaluation" CASCADE;
DROP TABLE IF EXISTS "hrm_evaluation_cycle" CASCADE;
DROP TABLE IF EXISTS "hrm_grade_scale" CASCADE;
DROP TABLE IF EXISTS "hrm_kpi_template_item" CASCADE;
DROP TABLE IF EXISTS "hrm_kpi_template" CASCADE;
DROP TABLE IF EXISTS "hrm_company_kpi_target" CASCADE;
DROP TABLE IF EXISTS "hrm_kpi" CASCADE;

-- DropEnum
DROP TYPE IF EXISTS "DevPlanStatus";
DROP TYPE IF EXISTS "RaterType";
DROP TYPE IF EXISTS "EvidenceStatus";
DROP TYPE IF EXISTS "EvaluationStatus";
DROP TYPE IF EXISTS "CycleStatus";
DROP TYPE IF EXISTS "CyclePeriodType";
DROP TYPE IF EXISTS "KpiSection";
DROP TYPE IF EXISTS "KpiScoringMethod";
DROP TYPE IF EXISTS "KpiFrequency";
DROP TYPE IF EXISTS "KpiDirection";
DROP TYPE IF EXISTS "KpiLevel";
DROP TYPE IF EXISTS "KpiCategory";
