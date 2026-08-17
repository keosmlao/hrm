-- ຂໍ້ມູນລົດທີ່ໄດ້ຈາກ Lao GPS Open API ເຊິ່ງ app_car_vehicles (ERP) ບໍ່ມີບ່ອນເກັບ.
-- additive ລ້ວນໆ — ບໍ່ແຕະ schema ຂອງຕາຕະລາງ ERP ໃດເລີຍ.
-- ຜູກດ້ວຍ imei (UNIQUE ທັງສອງຝັ່ງ) ບໍ່ແມ່ນ id ເພື່ອບໍ່ໃຫ້ຂາດເມື່ອ ERP ສ້າງແຖວໃໝ່.
CREATE TABLE "hrm_vehicle_gps" (
  "imei" VARCHAR(32) NOT NULL,
  "gps_vehicle_id" INTEGER,
  "plate" TEXT,
  "car_model" TEXT,
  "category" TEXT,
  "province" TEXT,
  "chassis" TEXT,
  "asset" TEXT,
  "device_model" TEXT,
  "sim" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "has_camera" BOOLEAN NOT NULL DEFAULT false,
  "overspeed_kmh" DOUBLE PRECISION,
  "park_limit_min" DOUBLE PRECISION,
  "tank_litre" DOUBLE PRECISION,
  "km_per_litre" DOUBLE PRECISION,
  "fuel_method" TEXT,
  "fuel_reason" TEXT,
  "expire_date" TIMESTAMP(3),
  "registered_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_vehicle_gps_pkey" PRIMARY KEY ("imei")
);

CREATE INDEX "hrm_vehicle_gps_expire_date_idx" ON "hrm_vehicle_gps" ("expire_date");
CREATE INDEX "hrm_vehicle_gps_active_idx" ON "hrm_vehicle_gps" ("active");
