-- ສິດເມນູ "ຕໍ່ຜູ້ໃຊ້" — ໃຊ້ override ສິດຂອງ role ເປັນລາຍຄົນ.
-- ຜູ້ໃຊ້ທີ່ບໍ່ມີແຖວໃດເລີຍ = ໃຊ້ສິດຕາມ role ຂອງຕົນຕາມປົກກະຕິ.
CREATE TABLE "hrm_user_menu" (
  "user_id"    TEXT NOT NULL,
  "menu_key"   TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "hrm_user_menu_pkey" PRIMARY KEY ("user_id", "menu_key"),
  CONSTRAINT "hrm_user_menu_user_fk" FOREIGN KEY ("user_id")
    REFERENCES "hrm_user"("id") ON DELETE CASCADE
);

CREATE INDEX "hrm_user_menu_user_idx" ON "hrm_user_menu" ("user_id");
