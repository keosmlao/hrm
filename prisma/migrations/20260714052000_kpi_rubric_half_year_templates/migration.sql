-- KPI rubric templates are additive because this database is shared with other systems.
CREATE TYPE "KpiScoringMethod" AS ENUM ('NUMERIC', 'RATING_1_4');
CREATE TYPE "KpiSection" AS ENUM ('PERFORMANCE', 'CORE_VALUE', 'CORE_COMPETENCY');

ALTER TABLE "hrm_kpi"
  ADD COLUMN "scoring_method" "KpiScoringMethod" NOT NULL DEFAULT 'NUMERIC';

ALTER TABLE "hrm_kpi_template"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "source_file" TEXT,
  ADD COLUMN "unit_code" VARCHAR(20);

ALTER TABLE "hrm_kpi_template"
  ADD CONSTRAINT "hrm_kpi_template_unit_code_fkey"
  FOREIGN KEY ("unit_code") REFERENCES "odg_unit"("unit_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hrm_kpi_template_item"
  ALTER COLUMN "target" SET DEFAULT 0,
  ADD COLUMN "section" "KpiSection" NOT NULL DEFAULT 'PERFORMANCE',
  ADD COLUMN "key_result_area" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "evidence_requirement" TEXT,
  ADD COLUMN "rating_4_label" TEXT,
  ADD COLUMN "rating_3_label" TEXT,
  ADD COLUMN "rating_2_label" TEXT,
  ADD COLUMN "rating_1_label" TEXT;

ALTER TABLE "hrm_evaluation_item"
  ADD COLUMN "scoring_method" "KpiScoringMethod" NOT NULL DEFAULT 'NUMERIC',
  ADD COLUMN "section" "KpiSection" NOT NULL DEFAULT 'PERFORMANCE',
  ADD COLUMN "key_result_area" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "evidence_requirement" TEXT,
  ADD COLUMN "rating_4_label" TEXT,
  ADD COLUMN "rating_3_label" TEXT,
  ADD COLUMN "rating_2_label" TEXT,
  ADD COLUMN "rating_1_label" TEXT,
  ADD COLUMN "h1_rating" INTEGER,
  ADD COLUMN "h2_rating" INTEGER,
  ADD COLUMN "h1_comment" TEXT,
  ADD COLUMN "h2_comment" TEXT,
  ADD COLUMN "h1_rated_at" TIMESTAMP(3),
  ADD COLUMN "h2_rated_at" TIMESTAMP(3),
  ADD COLUMN "h1_rated_by_user_id" TEXT,
  ADD COLUMN "h2_rated_by_user_id" TEXT;

ALTER TABLE "hrm_evaluation_item"
  ADD CONSTRAINT "hrm_evaluation_item_h1_rating_check"
  CHECK ("h1_rating" IS NULL OR "h1_rating" BETWEEN 1 AND 4),
  ADD CONSTRAINT "hrm_evaluation_item_h2_rating_check"
  CHECK ("h2_rating" IS NULL OR "h2_rating" BETWEEN 1 AND 4);
