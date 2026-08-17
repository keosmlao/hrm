"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { nextAssetCode } from "@/lib/asset-code";

/**
 * ຊັບສິນ — ທະບຽນຫຼັກຄື `as_asset` ຂອງ SML (623 ລາຍການ).
 * HRM ອ່ານ **ແລະ ແກ້ໄດ້** ສ່ວນການມອບ-ສົ່ງຄືນເປັນຂອງ HRM ເອງ
 * (`hrm_asset_assignment`) ຜູກດ້ວຍລະຫັດຊັບສິນຂອງ SML.
 */

export type AssetFormState = { error?: string; success?: string };

const assetSchema = z.object({
  code: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1).max(200),
  typeCode: z.string().trim().max(50).optional(),
  locationCode: z.string().trim().max(50).optional(),
  departmentCode: z.string().trim().max(20).optional(),
  branchCode: z.string().trim().max(20).optional(),
  brand: z.string().trim().max(100).optional(),
  modelInfo: z.string().trim().max(200).optional(),
  serialNo: z.string().trim().max(100).optional(),
  holderName: z.string().trim().max(200).optional(),
  unitCode: z.string().trim().max(50).optional(),
  remark: z.string().trim().max(500).optional(),
  status: z.coerce.number().int().min(0).max(9).optional(),
});

/** ຄ່າຫວ່າງໃນ SML ເປັນ "" ບໍ່ແມ່ນ null — ຮັກສາຮູບແບບເດີມໄວ້ */
const blank = (v: string | undefined) => v ?? "";

export async function createAsset(
  _previous: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = assetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດຊື່ ແລະ ປະເພດຊັບສິນ" };
  const v = parsed.data;
  if (!v.typeCode) return { error: "ຕ້ອງເລືອກປະເພດ — ລະຫັດອອກຕາມປະເພດ" };

  // ອອກເລກຕໍ່ໃຫ້ເອງ. ຖ້າມີຄົນສ້າງພ້ອມກັນ ລະຫັດຈະຊ້ຳ (PK) → ຄິດໃໝ່ແລ້ວລອງອີກ
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.smlAsset.findMany({
      where: { code: { startsWith: `${v.typeCode}-` } },
      select: { code: true },
    });
    const code = nextAssetCode(v.typeCode, existing.map((e) => e.code));

    try {
      await prisma.smlAsset.create({
        data: {
          code,
          name: v.name,
          typeCode: v.typeCode,
          locationCode: blank(v.locationCode),
          departmentCode: blank(v.departmentCode),
          branchCode: blank(v.branchCode),
          brand: blank(v.brand),
          modelInfo: blank(v.modelInfo),
          serialNo: blank(v.serialNo),
          holderName: blank(v.holderName),
          unitCode: blank(v.unitCode),
          remark: blank(v.remark),
          status: v.status ?? 0,
        },
      });
      await prisma.auditLog.create({
        data: { userId: session.userId, action: "CREATE", entityType: "Asset", entityId: code, detail: `${code} · ${v.name}` },
      });
      revalidatePath("/assets");
      return { success: `ສ້າງແລ້ວ · ລະຫັດ ${code}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Unique") && !msg.includes("as_asset_pk_code")) throw e;
      // ຊ້ຳ → ວົນໃໝ່
    }
  }
  return { error: "ອອກລະຫັດບໍ່ສຳເລັດ — ລອງໃໝ່ອີກຄັ້ງ" };
}

/** ລະຫັດຕໍ່ໄປຂອງປະເພດນີ້ — ໃຫ້ຟອມສະແດງລ່ວງໜ້າ */
export async function previewAssetCode(typeCode: string): Promise<string | null> {
  await requireRole("ADMIN", "HR");
  if (!typeCode) return null;
  const existing = await prisma.smlAsset.findMany({
    where: { code: { startsWith: `${typeCode}-` } },
    select: { code: true },
  });
  return nextAssetCode(typeCode, existing.map((e) => e.code));
}

/** ແກ້ຊັບສິນໃນ SML — ລະຫັດ (`code`) ປ່ຽນບໍ່ໄດ້ ເພາະເປັນກະແຈຫຼັກ */
export async function updateAsset(formData: FormData): Promise<AssetFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = assetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດຂໍ້ມູນທີ່ໃສ່" };
  const v = parsed.data;

  if (!v.code) return { error: "ບໍ່ພົບລະຫັດຊັບສິນ" };
  const before = await prisma.smlAsset.findUnique({ where: { code: v.code } });
  if (!before) return { error: "ບໍ່ພົບຊັບສິນນີ້" };

  await prisma.smlAsset.update({
    where: { code: v.code },
    data: {
      name: v.name,
      typeCode: blank(v.typeCode),
      locationCode: blank(v.locationCode),
      departmentCode: blank(v.departmentCode),
      branchCode: blank(v.branchCode),
      brand: blank(v.brand),
      modelInfo: blank(v.modelInfo),
      serialNo: blank(v.serialNo),
      holderName: blank(v.holderName),
      unitCode: blank(v.unitCode),
      remark: blank(v.remark),
      status: v.status ?? before.status ?? 0,
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "UPDATE", entityType: "Asset", entityId: v.code, detail: `${v.code} · ${v.name}` },
  });
  revalidatePath("/assets");
  return { success: "ບັນທຶກແລ້ວ" };
}

const assignmentSchema = z.object({
  assetCode: z.string().min(1),
  employeeCode: z.string().min(1),
  assignedDate: z.string().min(1),
  condition: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function assignAsset(
  _previous: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາເລືອກຊັບສິນ, ພະນັກງານ ແລະ ວັນທີ" };

  // ບໍ່ມີ FK ໄປຫາ as_asset (SML sync ຈາກພາຍນອກ) — ກວດເອງທີ່ນີ້
  const asset = await prisma.smlAsset.findUnique({ where: { code: parsed.data.assetCode } });
  if (!asset) return { error: "ບໍ່ພົບຊັບສິນນີ້ໃນທະບຽນ" };

  const active = await prisma.assetAssignment.findFirst({
    where: { assetCode: parsed.data.assetCode, returnedDate: null },
  });
  if (active) return { error: "ຊັບສິນນີ້ຖືກມອບໃຫ້ພະນັກງານຄົນອື່ນແລ້ວ" };

  const assignment = await prisma.assetAssignment.create({
    data: {
      assetCode: parsed.data.assetCode,
      employeeCode: parsed.data.employeeCode,
      assignedDate: new Date(`${parsed.data.assignedDate}T00:00:00Z`),
      condition: parsed.data.condition || null,
      note: parsed.data.note || null,
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "ASSIGN", entityType: "Asset", entityId: assignment.assetCode, detail: `${asset.code} → ${assignment.employeeCode}` },
  });
  revalidatePath("/assets");
  revalidatePath(`/employees/${assignment.employeeCode}`);
  return { success: "ມອບຊັບສິນແລ້ວ" };
}

export async function returnAsset(assignmentId: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const assignment = await prisma.assetAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.returnedDate) return;

  const date = String(formData.get("returnedDate") ?? "");
  const returnedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`)
    : new Date();

  await prisma.assetAssignment.update({ where: { id: assignmentId }, data: { returnedDate } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "RETURN", entityType: "Asset", entityId: assignment.assetCode, detail: `${assignment.assetCode} ← ${assignment.employeeCode}` },
  });
  revalidatePath("/assets");
  revalidatePath(`/employees/${assignment.employeeCode}`);
}

/** ລຶບໄດ້ສະເພາະຊັບສິນທີ່ບໍ່ເຄີຍຖືກມອບໃຫ້ໃຜ */
export async function deleteAsset(assetCode: string) {
  const session = await requireRole("ADMIN", "HR");
  const [asset, used] = await Promise.all([
    prisma.smlAsset.findUnique({ where: { code: assetCode } }),
    prisma.assetAssignment.count({ where: { assetCode } }),
  ]);
  if (!asset || used > 0) return;

  await prisma.smlAsset.delete({ where: { code: assetCode } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "DELETE", entityType: "Asset", entityId: assetCode, detail: `${asset.code} · ${asset.name}` },
  });
  revalidatePath("/assets");
}
