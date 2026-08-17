ALTER TABLE "hrm_kpi_template_item"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "hrm_evaluation_item"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
