ALTER TABLE "hrm_vehicle_trip"
  ADD COLUMN "trip_type" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "workflow_status" TEXT NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN "sales_target" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "opening_odometer" INTEGER,
  ADD COLUMN "closing_odometer" INTEGER,
  ADD COLUMN "opening_fuel" DOUBLE PRECISION,
  ADD COLUMN "closing_fuel" DOUBLE PRECISION,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "returned_at" TIMESTAMP(3),
  ADD COLUMN "closed_at" TIMESTAMP(3);

CREATE TABLE "hrm_sale_trip_customer" (
  "id" TEXT NOT NULL, "sequence" INTEGER NOT NULL DEFAULT 1,
  "customer_code" TEXT, "customer_name" TEXT NOT NULL, "phone" TEXT, "address" TEXT,
  "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION, "planned_at" TIMESTAMP(3),
  "checked_in_at" TIMESTAMP(3), "checked_out_at" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "note" TEXT, "trip_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hrm_sale_trip_customer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hrm_sale_trip_product" (
  "id" TEXT NOT NULL, "product_code" TEXT NOT NULL, "product_name" TEXT NOT NULL, "unit" TEXT,
  "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0, "loaded_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "sold_qty" DECIMAL(14,3) NOT NULL DEFAULT 0, "sample_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "returned_qty" DECIMAL(14,3) NOT NULL DEFAULT 0, "damaged_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "trip_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hrm_sale_trip_product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hrm_sale_trip_order" (
  "id" TEXT NOT NULL, "order_no" TEXT NOT NULL, "customer_name" TEXT NOT NULL,
  "payment_type" TEXT NOT NULL DEFAULT 'CASH', "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0, "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0, "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED', "note" TEXT, "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trip_id" TEXT NOT NULL, "customer_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hrm_sale_trip_order_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hrm_sale_trip_order_item" (
  "id" TEXT NOT NULL, "product_code" TEXT NOT NULL, "product_name" TEXT NOT NULL, "unit" TEXT,
  "quantity" DECIMAL(14,3) NOT NULL, "unit_price" DECIMAL(14,2) NOT NULL,
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0, "total" DECIMAL(14,2) NOT NULL,
  "order_id" TEXT NOT NULL,
  CONSTRAINT "hrm_sale_trip_order_item_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hrm_sale_trip_payment" (
  "id" TEXT NOT NULL, "method" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "reference" TEXT, "proof_url" TEXT, "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trip_id" TEXT NOT NULL, "order_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_sale_trip_payment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hrm_sale_trip_expense" (
  "id" TEXT NOT NULL, "type" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "note" TEXT, "receipt_url" TEXT, "incurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_by_code" VARCHAR(20), "trip_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_sale_trip_expense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hrm_sale_trip_product_trip_id_product_code_key" ON "hrm_sale_trip_product"("trip_id", "product_code");
CREATE UNIQUE INDEX "hrm_sale_trip_order_order_no_key" ON "hrm_sale_trip_order"("order_no");
CREATE INDEX "hrm_sale_trip_customer_trip_id_sequence_idx" ON "hrm_sale_trip_customer"("trip_id", "sequence");
CREATE INDEX "hrm_sale_trip_product_trip_id_idx" ON "hrm_sale_trip_product"("trip_id");
CREATE INDEX "hrm_sale_trip_order_trip_id_sold_at_idx" ON "hrm_sale_trip_order"("trip_id", "sold_at");
CREATE INDEX "hrm_sale_trip_order_customer_id_idx" ON "hrm_sale_trip_order"("customer_id");
CREATE INDEX "hrm_sale_trip_order_item_order_id_idx" ON "hrm_sale_trip_order_item"("order_id");
CREATE INDEX "hrm_sale_trip_payment_trip_id_received_at_idx" ON "hrm_sale_trip_payment"("trip_id", "received_at");
CREATE INDEX "hrm_sale_trip_payment_order_id_idx" ON "hrm_sale_trip_payment"("order_id");
CREATE INDEX "hrm_sale_trip_expense_trip_id_incurred_at_idx" ON "hrm_sale_trip_expense"("trip_id", "incurred_at");

ALTER TABLE "hrm_sale_trip_customer" ADD CONSTRAINT "hrm_sale_trip_customer_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "hrm_vehicle_trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_product" ADD CONSTRAINT "hrm_sale_trip_product_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "hrm_vehicle_trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_order" ADD CONSTRAINT "hrm_sale_trip_order_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "hrm_vehicle_trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_order" ADD CONSTRAINT "hrm_sale_trip_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "hrm_sale_trip_customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_order_item" ADD CONSTRAINT "hrm_sale_trip_order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "hrm_sale_trip_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_payment" ADD CONSTRAINT "hrm_sale_trip_payment_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "hrm_vehicle_trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_payment" ADD CONSTRAINT "hrm_sale_trip_payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "hrm_sale_trip_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hrm_sale_trip_expense" ADD CONSTRAINT "hrm_sale_trip_expense_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "hrm_vehicle_trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
