"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type UnitFormState = { error?: string; success?: string };

/** ລະຫັດໜ່ວຍງານ = odg_unit.unit_code (varchar 20) — ລະບົບອື່ນອ້າງອີງ ຈຶ່ງຫ້າມແກ້ຫຼັງສ້າງ */
const unitSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9._-]+$/, "ລະຫັດໃຊ້ໄດ້ແຕ່ຕົວເລກ, ອັກສອນອັງກິດ, . _ -"),
  departmentCode: z.string().trim().min(1).max(20),
  nameLo: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).optional(),
});

function revalidateUnits() {
  revalidatePath("/settings/units");
  revalidatePath("/org");
  revalidatePath("/employees");
  revalidatePath("/employees/new");
}

/** ເພີ່ມໜ່ວຍງານໃໝ່ໃສ່ພະແນກ */
export async function createUnit(
  _previous: UnitFormState,
  formData: FormData,
): Promise<UnitFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = unitSchema.safeParse({
    code: formData.get("code"),
    departmentCode: formData.get("departmentCode"),
    nameLo: formData.get("nameLo"),
    nameEn: formData.get("nameEn") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ກະລຸນາໃສ່ພະແນກ, ລະຫັດ ແລະ ຊື່ໜ່ວຍງານ" };
  }
  const { code, departmentCode, nameLo, nameEn } = parsed.data;

  const [department, existing] = await Promise.all([
    prisma.department.findUnique({ where: { code: departmentCode }, select: { nameLo: true } }),
    prisma.unit.findUnique({ where: { code }, select: { nameLo: true, departmentCode: true } }),
  ]);
  if (!department) return { error: "ບໍ່ພົບພະແນກທີ່ເລືອກ" };
  if (existing) {
    return { error: `ລະຫັດ ${code} ຖືກໃຊ້ແລ້ວ (${existing.nameLo} · ພະແນກ ${existing.departmentCode})` };
  }

  await prisma.unit.create({
    data: { code, departmentCode, nameLo, nameEn: nameEn || null, isActive: true },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "CREATE",
      entityType: "Unit",
      entityId: code,
      detail: `${nameLo} · ພະແນກ ${departmentCode} ${department.nameLo}`,
    },
  });

  revalidateUnits();
  return { success: `ເພີ່ມໜ່ວຍງານ ${code} — ${nameLo} ແລ້ວ` };
}

/** ແກ້ຊື່ ແລະ ເປີດ/ປິດໃຊ້ງານ — ລະຫັດ ແລະ ພະແນກ ບໍ່ໃຫ້ປ່ຽນ ເພາະລະບົບອື່ນອ້າງອີງຢູ່ */
export async function updateUnit(code: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const current = await prisma.unit.findUnique({ where: { code } });
  if (!current) redirect("/settings/units?unitError=" + encodeURIComponent("ບໍ່ພົບໜ່ວຍງານນີ້"));

  const parsed = z
    .object({
      nameLo: z.string().trim().min(1).max(200),
      nameEn: z.string().trim().max(200).optional(),
    })
    .safeParse({
      nameLo: formData.get("nameLo"),
      nameEn: formData.get("nameEn") || undefined,
    });
  if (!parsed.success) {
    redirect("/settings/units?unitError=" + encodeURIComponent(`ຊື່ໜ່ວຍງານ ${code} ຫ້າມວ່າງ`));
  }

  const isActive = formData.get("isActive") === "on";
  await prisma.unit.update({
    where: { code },
    data: { nameLo: parsed.data.nameLo, nameEn: parsed.data.nameEn || null, isActive },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "Unit",
      entityId: code,
      detail: `${current.nameLo} → ${parsed.data.nameLo}${isActive ? "" : " (ປິດໃຊ້ງານ)"}`,
    },
  });

  revalidateUnits();

  // ປິດໃຊ້ງານທັ້ງທີ່ຍັງມີຄົນຢູ່ → ບອກໃຫ້ຮູ້ ແຕ່ບໍ່ຂັດ (ຄົນເກົ່າຍັງຄາໜ່ວຍງານເດີມ)
  if (!isActive) {
    const staff = await prisma.employee.count({ where: { unitCode: code } });
    if (staff > 0) {
      redirect(
        "/settings/units?unitMessage=" +
          encodeURIComponent(`ປິດໃຊ້ງານ ${code} ແລ້ວ — ຍັງມີພະນັກງານ ${staff} ຄົນຢູ່ໜ່ວຍງານນີ້ ກະລຸນາຍ້າຍກ່ອນ`),
      );
    }
  }
  redirect("/settings/units?unitMessage=" + encodeURIComponent(`ບັນທຶກ ${code} ແລ້ວ`));
}

/** ລຶບໄດ້ສະເພາະໜ່ວຍງານທີ່ຍັງບໍ່ມີໃຜຢູ່ — ມີຄົນຢູ່ແລ້ວໃຫ້ປິດໃຊ້ງານແທນ */
export async function deleteUnit(code: string) {
  const session = await requireRole("ADMIN", "HR");
  const unit = await prisma.unit.findUnique({ where: { code } });
  if (!unit) redirect("/settings/units?unitError=" + encodeURIComponent("ບໍ່ພົບໜ່ວຍງານນີ້"));

  const staff = await prisma.employee.count({ where: { unitCode: code } });
  if (staff > 0) {
    redirect(
      "/settings/units?unitError=" +
        encodeURIComponent(`ລຶບ ${code} ບໍ່ໄດ້ ເພາະມີພະນັກງານ ${staff} ຄົນຢູ່ — ປິດໃຊ້ງານແທນໄດ້`),
    );
  }

  await prisma.unit.delete({ where: { code } });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "DELETE",
      entityType: "Unit",
      entityId: code,
      detail: `${unit.nameLo} · ພະແນກ ${unit.departmentCode}`,
    },
  });

  revalidateUnits();
  redirect("/settings/units?unitMessage=" + encodeURIComponent(`ລຶບໜ່ວຍງານ ${code} ແລ້ວ`));
}
