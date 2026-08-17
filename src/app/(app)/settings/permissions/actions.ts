"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/menu";
import { prisma } from "@/lib/prisma";
import { saveRolePermissions, saveUserPermissions } from "@/lib/permissions";

export type SaveState = { ok: true; role: Role } | { ok: false; error: string };

/**
 * ບັນທຶກສິດເມນູຂອງ role ໜຶ່ງ.
 * ສະເພາະ ADMIN — ຄົນທີ່ຕັ້ງສິດໄດ້ ຕ້ອງເປັນຄົນທີ່ບໍ່ຖືກສິດຈຳກັດເອງ.
 */
export async function saveMenuPermissions(form: FormData): Promise<SaveState> {
  const session = await requireRole("ADMIN");

  const role = String(form.get("role") ?? "") as Role;
  if (!ROLES.includes(role)) return { ok: false, error: "ບໍ່ຮູ້ຈັກ role ນີ້" };
  if (role === "ADMIN") {
    return { ok: false, error: "ADMIN ເຫັນທຸກເມນູສະເໝີ — ຕັ້ງຈຳກັດບໍ່ໄດ້" };
  }

  const keys = form.getAll("key").map(String);
  await saveRolePermissions(role, keys, session.userId);

  revalidatePath("/settings/permissions");
  revalidatePath("/", "layout");
  return { ok: true, role };
}

export type UserSaveState = { ok: true; cleared: boolean } | { ok: false; error: string };

/**
 * ບັນທຶກສິດເມນູ "ຕໍ່ຄົນ".
 * ຕິກ `useRole` = ລຶບ override ອອກ ແລ້ວກັບໄປໃຊ້ສິດຕາມ role ຂອງຕົນ.
 */
export async function saveUserMenuPermissions(form: FormData): Promise<UserSaveState> {
  const session = await requireRole("ADMIN");

  const userId = String(form.get("userId") ?? "");
  if (!userId) return { ok: false, error: "ບໍ່ພົບຜູ້ໃຊ້" };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: "ບໍ່ພົບຜູ້ໃຊ້" };
  if (target.role === "ADMIN") {
    return { ok: false, error: "ADMIN ເຫັນທຸກເມນູສະເໝີ — ຕັ້ງຈຳກັດບໍ່ໄດ້" };
  }

  const useRole = form.get("useRole") === "on";
  await saveUserPermissions(userId, useRole ? null : form.getAll("key").map(String), session.userId);

  revalidatePath("/settings/permissions");
  revalidatePath("/", "layout");
  return { ok: true, cleared: useRole };
}
