CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "hrm_attendance_correction_request" (
    "id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "requested_check_in_at" TIMESTAMP(6),
    "requested_check_out_at" TIMESTAMP(6),
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requester_user_id" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "employee_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hrm_attendance_correction_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hrm_attendance_correction_request_employee_code_work_date_idx"
ON "hrm_attendance_correction_request"("employee_code", "work_date");

CREATE INDEX "hrm_attendance_correction_request_status_created_at_idx"
ON "hrm_attendance_correction_request"("status", "created_at");

ALTER TABLE "hrm_attendance_correction_request"
ADD CONSTRAINT "hrm_attendance_correction_request_employee_code_fkey"
FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code")
ON DELETE CASCADE ON UPDATE CASCADE;
