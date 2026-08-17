-- ຮູບຮັບ/ສົ່ງລົດ (handover) — ເກັບ URL (ຮູບຢູ່ public/uploads)
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "departure_photo_url" TEXT;
ALTER TABLE "hrm_vehicle_trip" ADD COLUMN "return_photo_url" TEXT;
