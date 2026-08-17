ALTER TABLE "hrm_overtime_request"
ADD COLUMN "rate_type" VARCHAR(20) NOT NULL DEFAULT 'WORKDAY';

UPDATE "hrm_overtime_request"
SET "rate_type" = CASE
  WHEN "rate" >= 3 THEN 'HOLIDAY'
  WHEN "rate" >= 2 THEN 'DAY_OFF'
  ELSE 'WORKDAY'
END;
