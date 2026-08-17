-- ໃບຂໍນຳໃຊ້ລົດ ຝ່າຍຂາຍ — ລວມຫຼາຍແຜນ (trip) ເປັນເອກະສານດຽວ (additive, ບໍ່ກະທົບຕາຕະລາງເກົ່າ)
CREATE TABLE "hrm_sale_vehicle_request" (
  "id" TEXT NOT NULL,
  "request_no" TEXT NOT NULL,
  "requested_by_code" VARCHAR(20) NOT NULL,
  "trip_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approved_by" VARCHAR(20),
  "approved_at" TIMESTAMP(3),
  "reject_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hrm_sale_vehicle_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hrm_sale_vehicle_request_requested_by_code_idx" ON "hrm_sale_vehicle_request" ("requested_by_code");
CREATE INDEX "hrm_sale_vehicle_request_status_idx" ON "hrm_sale_vehicle_request" ("status");
