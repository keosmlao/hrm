-- Configurable employee work shifts with effective-dated assignment history.
-- Additive only: no existing odg_* or hrm_* columns are changed.

CREATE TABLE "hrm_work_shift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hrm_work_shift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hrm_employee_shift_assignment" (
    "id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "note" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "shift_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hrm_employee_shift_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hrm_work_shift_code_key" ON "hrm_work_shift"("code");
CREATE UNIQUE INDEX "hrm_employee_shift_assignment_employee_code_effective_from_key"
    ON "hrm_employee_shift_assignment"("employee_code", "effective_from");
CREATE INDEX "hrm_employee_shift_assignment_employee_code_effective_from_effective_to_idx"
    ON "hrm_employee_shift_assignment"("employee_code", "effective_from", "effective_to");
CREATE INDEX "hrm_employee_shift_assignment_shift_id_idx"
    ON "hrm_employee_shift_assignment"("shift_id");

ALTER TABLE "hrm_employee_shift_assignment"
    ADD CONSTRAINT "hrm_employee_shift_assignment_employee_code_fkey"
    FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hrm_employee_shift_assignment"
    ADD CONSTRAINT "hrm_employee_shift_assignment_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "hrm_work_shift"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "hrm_work_shift"
    ("id", "code", "name", "start_time", "end_time", "break_minutes", "late_grace_minutes", "is_active", "created_at", "updated_at")
VALUES
    ('default_shift_morning', 'SHIFT_1', 'ກະເຊົ້າ', '06:00', '14:00', 60, 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('default_shift_afternoon', 'SHIFT_2', 'ກະບ່າຍ', '14:00', '22:00', 60, 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('default_shift_night', 'SHIFT_3', 'ກະກາງຄືນ', '22:00', '06:00', 60, 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
