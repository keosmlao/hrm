-- ເກັບສາຂາປະຈຳຂອງລົດໃນ HRM ໂດຍບໍ່ແກ້ schema ຂອງ app_car_vehicles (ERP).
CREATE TABLE "hrm_vehicle_profile" (
  "vehicle_id" BIGINT NOT NULL,
  "branch_code" VARCHAR(20),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_vehicle_profile_pkey" PRIMARY KEY ("vehicle_id")
);

CREATE INDEX "hrm_vehicle_profile_branch_code_idx" ON "hrm_vehicle_profile"("branch_code");
