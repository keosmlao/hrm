import "server-only";
import { prisma } from "./prisma";
import { defaultKeysFor, menuForPath, MENU_ITEMS, type Role } from "./menu";

/**
 * ສິດການເຂົ້າໃຊ້ເມນູ ຕໍ່ role.
 *
 * ກົດ: ມີແຖວໃນ `hrm_menu_permission` = ອະນຸຍາດ.
 * role ທີ່ **ຍັງບໍ່ມີແຖວໃດເລີຍ** ຈະຕົກໄປໃຊ້ຄ່າເລີ່ມຕົ້ນຈາກ `menu.ts`
 * ຈຶ່ງລະບົບເຮັດວຽກປົກກະຕິກ່ອນຈະຕັ້ງຄ່າຄັ້ງທຳອິດ ແລະ ຕັ້ງບໍ່ຄົບກໍບໍ່ລັອກຄົນອອກ.
 *
 * ⚠ ການເຊື່ອງເມນູ **ບໍ່ແມ່ນ** ຄວາມປອດໄພ — ຕ້ອງກວດຝັ່ງເຊີບເວີນຳ.
 * `(app)/layout.tsx` ເອີ້ນ `assertPathAllowed()` ໃຫ້ທຸກໜ້າໃນກຸ່ມນັ້ນແລ້ວ.
 */

/** ADMIN ເຫັນທຸກເມນູສະເໝີ — ກັນຕັ້ງຄ່າຜິດແລ້ວລັອກຕົນເອງອອກຈາກໜ້າຕັ້ງຄ່າ */
function isSuper(role: Role) {
  return role === "ADMIN";
}

/**
 * ລະຫັດເມນູທີ່ຜູ້ໃຊ້ຄົນນີ້ເຂົ້າໄດ້ — ລຳດັບການຕັດສິນ:
 *   1. ADMIN → ທຸກເມນູ
 *   2. ມີສິດຕັ້ງໄວ້ "ຕໍ່ຄົນ" → ໃຊ້ອັນນັ້ນ (override)
 *   3. ມີສິດຕັ້ງໄວ້ຕາມ role → ໃຊ້ອັນນັ້ນ
 *   4. ບໍ່ມີເລີຍ → ຄ່າເລີ່ມຕົ້ນຈາກ code
 */
export async function allowedMenuKeys(role: Role, userId?: string): Promise<Set<string>> {
  if (isSuper(role)) return new Set(MENU_ITEMS.map((i) => i.key));

  if (userId) {
    const mine = await prisma.userMenuPermission.findMany({
      where: { userId },
      select: { menuKey: true },
    });
    if (mine.length > 0) return new Set(mine.map((r) => r.menuKey));
  }

  const rows = await prisma.menuPermission.findMany({
    where: { role },
    select: { menuKey: true },
  });
  if (rows.length === 0) return new Set(defaultKeysFor(role));
  return new Set(rows.map((r) => r.menuKey));
}

/** ບັນທຶກສິດຕໍ່ຄົນ — ສົ່ງ `null` ເພື່ອລຶບ override ແລ້ວກັບໄປໃຊ້ສິດຕາມ role */
export async function saveUserPermissions(
  userId: string,
  keys: string[] | null,
  byUserId: string,
) {
  const valid = new Set(MENU_ITEMS.map((i) => i.key));
  const clean = keys ? [...new Set(keys)].filter((k) => valid.has(k)) : [];

  await prisma.$transaction([
    prisma.userMenuPermission.deleteMany({ where: { userId } }),
    ...(keys
      ? [
          prisma.userMenuPermission.createMany({
            data: clean.map((menuKey) => ({ userId, menuKey, updatedBy: byUserId })),
          }),
        ]
      : []),
  ]);
}

/** ສິດຂອງທຸກ role — ໃຊ້ໃນໜ້າຕັ້ງຄ່າ */
export async function permissionMatrix(): Promise<Record<string, Set<string>>> {
  const rows = await prisma.menuPermission.findMany({ select: { role: true, menuKey: true } });
  const configured = new Set(rows.map((r) => r.role));
  const out: Record<string, Set<string>> = {};
  for (const r of rows) (out[r.role] ??= new Set()).add(r.menuKey);
  return { ...out, __configured: configured as unknown as Set<string> };
}

/**
 * ເປີດ path ນີ້ໄດ້ບໍ.
 * Path ທີ່ບໍ່ຢູ່ໃນທະບຽນເມນູ (ເຊັ່ນໜ້າຍ່ອຍທີ່ຍັງບໍ່ລົງທະບຽນ) ອະນຸຍາດໄວ້ກ່ອນ —
 * ໜ້າພວກນັ້ນຍັງມີ `requireRole()` ຂອງຕົນເອງຢູ່.
 */
export async function canOpenPath(role: Role, pathname: string, userId?: string): Promise<boolean> {
  const item = menuForPath(pathname);
  if (!item) return true;
  return (await allowedMenuKeys(role, userId)).has(item.key);
}

/** ບັນທຶກສິດຂອງ role ໜຶ່ງ (ແທນທີ່ທັງຊຸດ) */
export async function saveRolePermissions(role: Role, keys: string[], byUserId: string) {
  const valid = new Set(MENU_ITEMS.map((i) => i.key));
  const clean = [...new Set(keys)].filter((k) => valid.has(k));

  await prisma.$transaction([
    prisma.menuPermission.deleteMany({ where: { role } }),
    prisma.menuPermission.createMany({
      data: clean.map((menuKey) => ({ role, menuKey, updatedBy: byUserId })),
    }),
  ]);
}
