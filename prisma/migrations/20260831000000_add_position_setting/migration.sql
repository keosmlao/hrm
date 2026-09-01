-- ລະດັບ ແລະ ລຳດັບແສດງຂອງຕຳແໜ່ງ — ເກັບແຍກຈາກ `odg_position` (ຕາຕະລາງ ERP ເກົ່າ ຫ້າມແກ້ໂຄງສ້າງ).
-- ບໍ່ໃສ່ FK ໄປຫາ `odg_position` ຕາມແນວທາງເກົ່າຂອງ HRM (ຄຸມຄວາມຖືກຕ້ອງໃນ code ແທນ).
-- ລະດັບ: ຕົວເລກນ້ອຍ = ສູງກວ່າ (10 ຜູ້ບໍລິຫານ … 70 ຝຶກງານ), ຫ່າງເທື່ອລະ 10 ເພື່ອແຊກລະດັບໃໝ່ໄດ້.
CREATE TABLE "hrm_position_setting" (
  "position_code" VARCHAR(20) NOT NULL,
  "position_level" INTEGER NOT NULL DEFAULT 60,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_position_setting_pkey" PRIMARY KEY ("position_code")
);

CREATE INDEX "hrm_position_setting_position_level_sort_order_idx"
  ON "hrm_position_setting"("position_level", "sort_order");

-- ຕຳແໜ່ງທີ່ມີຢູ່ແລ້ວ: ຫົວໜ້າ/ຜູ້ຈັດການ → ລະດັບ 30, ນອກນັ້ນ → 60
INSERT INTO "hrm_position_setting" ("position_code", "position_level", "sort_order")
SELECT "position_code", CASE WHEN "is_manager" IS TRUE THEN 30 ELSE 60 END, 0
FROM "odg_position"
ON CONFLICT ("position_code") DO NOTHING;
