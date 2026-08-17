-- HRM policy settings and public holidays.
-- Additive only: existing odg_* and hrm_* data is untouched.

CREATE TABLE "hrm_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hrm_setting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "hrm_public_holiday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hrm_public_holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hrm_public_holiday_date_key" ON "hrm_public_holiday"("date");
CREATE INDEX "hrm_public_holiday_date_idx" ON "hrm_public_holiday"("date");

INSERT INTO "hrm_setting" ("key", "value", "updated_at") VALUES
    ('attendance.work_start', '08:00', CURRENT_TIMESTAMP),
    ('attendance.work_end', '17:00', CURRENT_TIMESTAMP),
    ('attendance.late_grace_minutes', '15', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
