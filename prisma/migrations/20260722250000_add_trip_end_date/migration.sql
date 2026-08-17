ALTER TABLE "hrm_vehicle_trip"
ADD COLUMN "end_date" DATE;

UPDATE "hrm_vehicle_trip"
SET "end_date" = "date"
WHERE "end_date" IS NULL;

ALTER TABLE "hrm_vehicle_trip"
ALTER COLUMN "end_date" SET NOT NULL;

CREATE INDEX "hrm_vehicle_trip_end_date_idx"
ON "hrm_vehicle_trip"("end_date");
