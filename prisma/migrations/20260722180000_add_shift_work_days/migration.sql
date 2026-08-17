-- Selectable weekdays per work shift. ISO-like values: 0=Sunday ... 6=Saturday.

ALTER TABLE "hrm_work_shift"
    ADD COLUMN "work_days" TEXT NOT NULL DEFAULT '1,2,3,4,5';
