-- ══════════════════════════════════════════════════════════════
-- ຈັດການລົດ — hrm_vehicle, hrm_vehicle_trip, hrm_trip_member
-- ເພີ່ມຢ່າງດຽວ (additive) · ບໍ່ແຕະ odg_* ຫຼືຕາຕະລາງ hrm_* ອື່ນ
-- ══════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNED', 'DEPARTED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hrm_vehicle" (
    "id" TEXT NOT NULL,
    "plate_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_vehicle_trip" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trip_no" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "depart_time" TEXT,
    "return_time" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "vehicle_id" TEXT NOT NULL,
    "driver_code" VARCHAR(20),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_vehicle_trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_trip_member" (
    "trip_id" TEXT NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,

    CONSTRAINT "hrm_trip_member_pkey" PRIMARY KEY ("trip_id", "employee_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_vehicle_plate_no_key" ON "hrm_vehicle"("plate_no");

-- CreateIndex
CREATE UNIQUE INDEX "hrm_vehicle_trip_date_vehicle_id_trip_no_key" ON "hrm_vehicle_trip"("date", "vehicle_id", "trip_no");

-- CreateIndex
CREATE INDEX "hrm_vehicle_trip_date_idx" ON "hrm_vehicle_trip"("date");

-- CreateIndex
CREATE INDEX "hrm_trip_member_employee_code_idx" ON "hrm_trip_member"("employee_code");

-- AddForeignKey
ALTER TABLE "hrm_vehicle_trip" ADD CONSTRAINT "hrm_vehicle_trip_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "hrm_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_vehicle_trip" ADD CONSTRAINT "hrm_vehicle_trip_driver_code_fkey" FOREIGN KEY ("driver_code") REFERENCES "odg_employee"("employee_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_trip_member" ADD CONSTRAINT "hrm_trip_member_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "hrm_vehicle_trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrm_trip_member" ADD CONSTRAINT "hrm_trip_member_employee_code_fkey" FOREIGN KEY ("employee_code") REFERENCES "odg_employee"("employee_code") ON DELETE CASCADE ON UPDATE CASCADE;
