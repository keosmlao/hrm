-- ສິດການເຂົ້າໃຊ້ເມນູ ຕໍ່ role — additive, ບໍ່ກະທົບຕາຕະລາງເກົ່າ.
-- ມີແຖວ = ອະນຸຍາດ. role ທີ່ຍັງບໍ່ມີແຖວໃດເລີຍ = ໃຊ້ຄ່າເລີ່ມຕົ້ນຈາກ code
-- (ຈຶ່ງລະບົບຍັງເຮັດວຽກປົກກະຕິກ່ອນຈະຕັ້ງຄ່າຄັ້ງທຳອິດ).
CREATE TABLE "hrm_menu_permission" (
  "role" TEXT NOT NULL,
  "menu_key" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "hrm_menu_permission_pkey" PRIMARY KEY ("role", "menu_key")
);

CREATE INDEX "hrm_menu_permission_role_idx" ON "hrm_menu_permission" ("role");
