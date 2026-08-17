-- ຊັບສິນ: ໃຫ້ SML (`as_asset`, 623 ລາຍການ) ເປັນທະບຽນຫຼັກ ແທນ `hrm_asset` ທີ່ຫວ່າງເປົ່າ.
-- ການມອບ-ສົ່ງຄືນ ຍັງເປັນຂອງ HRM ແຕ່ອ້າງອີງດ້ວຍ **ລະຫັດຊັບສິນຂອງ SML**.
--
-- ປອດໄພ: `hrm_asset_assignment` ມີ 0 ແຖວ ຕອນປ່ຽນ ຈຶ່ງບໍ່ມີຂໍ້ມູນຕົກຫຼົ່ນ.
-- ບໍ່ໃສ່ FK ໄປຫາ `as_asset` ເພາະເປັນຕາຕະລາງຂອງ SML ທີ່ sync ຈາກລະບົບພາຍນອກ
-- (ຖ້າ sync ລຶບແຖວອອກຊົ່ວຄາວ FK ຈະບລັອກ) — ກວດຄວາມຖືກຕ້ອງໃນ code ແທນ.
ALTER TABLE "hrm_asset_assignment" DROP CONSTRAINT IF EXISTS "hrm_asset_assignment_asset_id_fkey";
DROP INDEX IF EXISTS "hrm_asset_assignment_asset_id_idx";

ALTER TABLE "hrm_asset_assignment" RENAME COLUMN "asset_id" TO "asset_code";
ALTER TABLE "hrm_asset_assignment" ALTER COLUMN "asset_code" TYPE VARCHAR(50);

CREATE INDEX "hrm_asset_assignment_asset_code_idx" ON "hrm_asset_assignment" ("asset_code");
