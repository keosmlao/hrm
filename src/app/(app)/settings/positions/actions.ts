"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type PositionFormState = { error?: string; success?: string };

/** ລະຫັດຕຳແໜ່ງ = odg_position.position_code (varchar 20) — ລະບົບອື່ນອ້າງອີງ ຈຶ່ງຫ້າມແກ້ຫຼັງສ້າງ */
const positionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9._-]+$/, "ລະຫັດໃຊ້ໄດ້ແຕ່ຕົວເລກ, ອັກສອນອັງກິດ, . _ -"),
  nameLo: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).optional(),
});

function revalidatePositions() {
  revalidatePath("/settings/positions");
  revalidatePath("/employees");
  revalidatePath("/employees/new");
  revalidatePath("/org");
  revalidatePath("/recruitment/postings");
}

/** ນັບບ່ອນທີ່ລະຫັດຕຳແໜ່ງນີ້ຖືກອ້າງອີງຢູ່ — ບໍ່ມີ FK ໃນ DB ຈຶ່ງຕ້ອງກວດເອງ */
async function usageOf(code: string) {
  const [staff, postings, movements] = await Promise.all([
    prisma.employee.count({ where: { positionCode: code } }),
    prisma.jobPosting.count({ where: { positionCode: code } }),
    prisma.employeeMovement.count({
      where: { OR: [{ fromPositionCode: code }, { toPositionCode: code }] },
    }),
  ]);
  return { staff, postings, movements };
}

/** ເພີ່ມຕຳແໜ່ງໃໝ່ */
export async function createPosition(
  _previous: PositionFormState,
  formData: FormData,
): Promise<PositionFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = positionSchema.safeParse({
    code: formData.get("code"),
    nameLo: formData.get("nameLo"),
    nameEn: formData.get("nameEn") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ກະລຸນາໃສ່ລະຫັດ ແລະ ຊື່ຕຳແໜ່ງ" };
  }
  const { code, nameLo, nameEn } = parsed.data;
  const isManager = formData.get("isManager") === "on";

  const existing = await prisma.position.findUnique({ where: { code }, select: { nameLo: true } });
  if (existing) return { error: `ລະຫັດ ${code} ຖືກໃຊ້ແລ້ວ (${existing.nameLo})` };

  await prisma.position.create({
    data: { code, nameLo, nameEn: nameEn || null, isManager, isActive: true },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "CREATE",
      entityType: "Position",
      entityId: code,
      detail: `${nameLo}${isManager ? " (ລະດັບຫົວໜ້າ)" : ""}`,
    },
  });

  revalidatePositions();
  return { success: `ເພີ່ມຕຳແໜ່ງ ${code} — ${nameLo} ແລ້ວ` };
}

/** ແກ້ຊື່, ລະດັບຫົວໜ້າ ແລະ ເປີດ/ປິດໃຊ້ງານ — ລະຫັດບໍ່ໃຫ້ປ່ຽນ ເພາະລະບົບອື່ນອ້າງອີງຢູ່ */
export async function updatePosition(code: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const current = await prisma.position.findUnique({ where: { code } });
  if (!current) {
    redirect("/settings/positions?positionError=" + encodeURIComponent("ບໍ່ພົບຕຳແໜ່ງນີ້"));
  }

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
    redirect(
      "/settings/positions?positionError=" + encodeURIComponent(`ຊື່ຕຳແໜ່ງ ${code} ຫ້າມວ່າງ`),
    );
  }

  const isManager = formData.get("isManager") === "on";
  const isActive = formData.get("isActive") === "on";
  await prisma.position.update({
    where: { code },
    data: { nameLo: parsed.data.nameLo, nameEn: parsed.data.nameEn || null, isManager, isActive },
  });

  const changes: string[] = [];
  if (current.nameLo !== parsed.data.nameLo) changes.push(`${current.nameLo} → ${parsed.data.nameLo}`);
  if ((current.isManager ?? false) !== isManager) {
    changes.push(isManager ? "ຕັ້ງເປັນລະດັບຫົວໜ້າ" : "ຍົກເລີກລະດັບຫົວໜ້າ");
  }
  if ((current.isActive !== false) !== isActive) changes.push(isActive ? "ເປີດໃຊ້ງານ" : "ປິດໃຊ້ງານ");
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "Position",
      entityId: code,
      detail: changes.join(" · ") || current.nameLo,
    },
  });

  revalidatePositions();

  // ປິດໃຊ້ງານທັ້ງທີ່ຍັງມີຄົນຖືຢູ່ → ບອກໃຫ້ຮູ້ ແຕ່ບໍ່ຂັດ (ຄົນເກົ່າຍັງຄາຕຳແໜ່ງເດີມ)
  if (!isActive) {
    const staff = await prisma.employee.count({ where: { positionCode: code } });
    if (staff > 0) {
      redirect(
        "/settings/positions?positionMessage=" +
          encodeURIComponent(
            `ປິດໃຊ້ງານ ${code} ແລ້ວ — ຍັງມີພະນັກງານ ${staff} ຄົນຖືຕຳແໜ່ງນີ້ ກະລຸນາຍ້າຍກ່ອນ`,
          ),
      );
    }
  }
  redirect("/settings/positions?positionMessage=" + encodeURIComponent(`ບັນທຶກ ${code} ແລ້ວ`));
}

/** ລຶບໄດ້ສະເພາະຕຳແໜ່ງທີ່ຍັງບໍ່ມີໃຜຖື ແລະ ບໍ່ມີປະຫວັດອ້າງອີງ — ນອກນັ້ນໃຫ້ປິດໃຊ້ງານແທນ */
export async function deletePosition(code: string) {
  const session = await requireRole("ADMIN", "HR");
  const position = await prisma.position.findUnique({ where: { code } });
  if (!position) {
    redirect("/settings/positions?positionError=" + encodeURIComponent("ບໍ່ພົບຕຳແໜ່ງນີ້"));
  }

  const { staff, postings, movements } = await usageOf(code);
  if (staff > 0 || postings > 0 || movements > 0) {
    const reasons = [
      staff > 0 ? `ພະນັກງານ ${staff} ຄົນ` : null,
      postings > 0 ? `ປະກາດຮັບສະໝັກ ${postings} ລາຍການ` : null,
      movements > 0 ? `ປະຫວັດການເໜັງຕີງ ${movements} ລາຍການ` : null,
    ].filter(Boolean);
    redirect(
      "/settings/positions?positionError=" +
        encodeURIComponent(`ລຶບ ${code} ບໍ່ໄດ້ ເພາະມີ${reasons.join(", ")}ອ້າງອີງຢູ່ — ປິດໃຊ້ງານແທນໄດ້`),
    );
  }

  await prisma.position.delete({ where: { code } });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "DELETE",
      entityType: "Position",
      entityId: code,
      detail: position.nameLo,
    },
  });

  revalidatePositions();
  redirect("/settings/positions?positionMessage=" + encodeURIComponent(`ລຶບຕຳແໜ່ງ ${code} ແລ້ວ`));
}
