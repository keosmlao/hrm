-- ໃຊ້ຂໍ້ມູນລົດຈາກ ERP (app_car_vehicles) ແທນ hrm_vehicle.
-- hrm_vehicle_trip.vehicle_id ຍັງເປັນ TEXT ແຕ່ເກັບ app_car_vehicles.id (soft ref, ບໍ່ມີ FK
-- ເພື່ອບໍ່ໃຫ້ HRM ໄປ constrain ຕາຕະລາງ ERP).
ALTER TABLE "hrm_vehicle_trip" DROP CONSTRAINT IF EXISTS "hrm_vehicle_trip_vehicle_id_fkey";
DROP TABLE IF EXISTS "hrm_vehicle";
