-- ມອບສິດເມນູ "ຄັງຄວາມຮູ້" ໃຫ້ role ທີ່**ຕັ້ງສິດໄວ້ແລ້ວ**.
--
-- ເປັນຫຍັງຕ້ອງມີ: `permissions.ts` ໃຊ້ຄ່າເລີ່ມຕົ້ນຈາກ `menu.ts` ສະເພາະ role ທີ່
-- **ຍັງບໍ່ມີແຖວໃດເລີຍ** ໃນ hrm_menu_permission. EMPLOYEE/HR/EXECUTIVE ຕັ້ງໄວ້ແລ້ວ
-- ກ່ອນຈະມີໂມດູນນີ້ ຈຶ່ງເມນູໃໝ່ຈະ "ມືດ" ສຳລັບເຂົາ (ເປີດໜ້າແລ້ວຖືກສົ່ງກັບ dashboard)
-- ຈົນກວ່າ admin ຈະໄປຕິກເອງ. ຕື່ມໃຫ້ຕາມ defaultRoles ຂອງ menu.ts.
-- ADMIN ບໍ່ຕ້ອງຕື່ມ — `isSuper()` ໃຫ້ເຫັນທຸກເມນູຢູ່ແລ້ວ.

-- ອ່ານຄັງ: ທຸກ role
INSERT INTO "hrm_menu_permission" ("role", "menu_key", "updated_at", "updated_by")
SELECT DISTINCT p."role", 'knowledge', CURRENT_TIMESTAMP, 'migration'
FROM "hrm_menu_permission" p
WHERE NOT EXISTS (
  SELECT 1 FROM "hrm_menu_permission" x WHERE x."role" = p."role" AND x."menu_key" = 'knowledge'
);

-- ຈັດການຄັງ: ສະເພາະ HR (ຄ່າເລີ່ມຕົ້ນຂອງ menu.ts ຄື ADMIN/HR)
INSERT INTO "hrm_menu_permission" ("role", "menu_key", "updated_at", "updated_by")
SELECT DISTINCT p."role", 'knowledge.manage', CURRENT_TIMESTAMP, 'migration'
FROM "hrm_menu_permission" p
WHERE p."role" = 'HR'
  AND NOT EXISTS (
    SELECT 1 FROM "hrm_menu_permission" x WHERE x."role" = 'HR' AND x."menu_key" = 'knowledge.manage'
  );
