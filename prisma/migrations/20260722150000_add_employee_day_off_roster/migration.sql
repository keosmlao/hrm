-- Monthly employee-specific rest-day rosters.
-- Shifts can either follow weekdays or use a rotating monthly roster.

CREATE TYPE "WorkScheduleType" AS ENUM ('WEEKDAYS', 'ROTATING');

ALTER TABLE "hrm_work_shift"
    ADD COLUMN "schedule_type" "WorkScheduleType" NOT NULL DEFAULT 'WEEKDAYS';

CREATE TABLE "hrm_employee_day_off" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hrm_employee_day_off_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hrm_employee_day_off_employee_code_date_key"
    ON "hrm_employee_day_off"("employee_code", "date");
CREATE INDEX "hrm_employee_day_off_date_idx" ON "hrm_employee_day_off"("date");
CREATE INDEX "hrm_employee_day_off_employee_code_date_idx"
    ON "hrm_employee_day_off"("employee_code", "date");

ALTER TABLE "hrm_employee_day_off"
    ADD CONSTRAINT "hrm_employee_day_off_employee_code_fkey"
    FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code")
    ON DELETE CASCADE ON UPDATE CASCADE;
