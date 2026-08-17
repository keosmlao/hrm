"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { laoGpsConfigured, laoGpsErrorMessage } from "@/lib/laogps";
import { applyVehicleSync, planVehicleSync, type SyncPlan } from "@/lib/laogps-sync";

/**
 * ດຶງລາຍການລົດຈາກ GPS — ແຍກ 2 ຂັ້ນຕອນໂດຍເຈດຕະນາ:
 * ກົດ "ກວດເບິ່ງ" ໄດ້ແຜນມາເບິ່ງກ່ອນ ແລ້ວຈຶ່ງກົດ "ບັນທຶກ" ຂຽນຈິງ.
 * ຈຳກັດສະເພາະ ADMIN ເພາະຂຽນໃສ່ຕາຕະລາງຂອງລະບົບ ERP.
 */

export type PreviewState =
  | { ok: true; plan: SyncPlan }
  | { ok: false; error: string };

export type ApplyState =
  | { ok: true; inserted: number; updated: number; conflicts: number }
  | { ok: false; error: string };

export async function previewGpsVehicles(): Promise<PreviewState> {
  await requireRole("ADMIN");
  if (!laoGpsConfigured()) {
    return { ok: false, error: "ຍັງບໍ່ໄດ້ຕັ້ງ GPS_OPENAPI_USER / GPS_OPENAPI_PASS ໃນ .env" };
  }
  try {
    return { ok: true, plan: await planVehicleSync() };
  } catch (e) {
    return { ok: false, error: laoGpsErrorMessage(e) };
  }
}

export type EditState = { ok: true } | { ok: false; error: string };

/**
 * ແກ້ຂໍ້ມູນລົດດ້ວຍມື — ຟິວທີ່ GPS ບໍ່ຮູ້ ຫຼື ໃສ່ຜິດ
 * (ປ້າຍ, ໄມລ໌, ພະແນກ, ສາຂາ, ປະເພດ).
 * ການຊິງຄ໌ຈາກ GPS ບໍ່ທັບຄ່າພວກນີ້ ນອກຈາກສັ່ງ --update-names ໂດຍສະເພາະ.
 */
export async function updateVehicle(form: FormData): Promise<EditState> {
  await requireRole("ADMIN", "HR");

  const id = String(form.get("id") ?? "");
  const plateNo = String(form.get("plateNo") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const status = String(form.get("status") ?? "").trim();
  const typeId = String(form.get("vehicleTypeId") ?? "").trim();
  const dept = String(form.get("departmentCode") ?? "").trim();
  const branchCode = String(form.get("branchCode") ?? "").trim();
  const mileageRaw = String(form.get("currentMileage") ?? "").trim();

  if (!/^\d+$/.test(id)) return { ok: false, error: "ລະຫັດລົດບໍ່ຖືກຕ້ອງ" };
  if (!plateNo) return { ok: false, error: "ຕ້ອງໃສ່ປ້າຍທະບຽນ" };
  if (!name) return { ok: false, error: "ຕ້ອງໃສ່ຍີ່ຫໍ້/ຊື່" };
  const mileage = mileageRaw === "" ? 0 : Number(mileageRaw);
  if (!Number.isFinite(mileage) || mileage < 0) return { ok: false, error: "ໄມລ໌ບໍ່ຖືກຕ້ອງ" };

  if (branchCode && branchCode !== "TRANSPORT") {
    const branch = await prisma.$queryRawUnsafe<Array<{ code: string }>>(
      `select code from erp_branch_list where code = $1 and code <> '99' limit 1`,
      branchCode,
    );
    if (!branch.length) return { ok: false, error: "ສາຂາທີ່ເລືອກບໍ່ຖືກຕ້ອງ" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.carVehicle.update({
        where: { id: BigInt(id) },
        data: {
          plateNo,
          name,
          status: status || null,
          currentMileage: Math.round(mileage),
          departmentCode: dept || null,
          vehicleTypeId: /^\d+$/.test(typeId) ? BigInt(typeId) : null,
        },
      });

      if (branchCode) {
        await tx.vehicleProfile.upsert({
          where: { vehicleId: BigInt(id) },
          create: { vehicleId: BigInt(id), branchCode },
          update: { branchCode },
        });
      } else {
        await tx.vehicleProfile.deleteMany({ where: { vehicleId: BigInt(id) } });
      }
    });
  } catch (e) {
    // plate_no ເປັນ UNIQUE — ຊ້ຳຈະລົ້ມທີ່ນີ້
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg.includes("plate_no") || msg.includes("Unique")
        ? `ປ້າຍທະບຽນ "${plateNo}" ຖືກໃຊ້ກັບລົດຄັນອື່ນແລ້ວ`
        : msg,
    };
  }

  revalidatePath("/fleet/vehicles");
  return { ok: true };
}

/** ເພີ່ມປະເພດລົດໃໝ່ (app_car_vehicle_types — id ເປັນ sequence) */
export async function createVehicleType(form: FormData): Promise<EditState> {
  await requireRole("ADMIN", "HR");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "ຕ້ອງໃສ່ຊື່ປະເພດ" };

  const exists = await prisma.carVehicleType.findFirst({ where: { name } });
  if (exists) return { ok: false, error: `ປະເພດ "${name}" ມີຢູ່ແລ້ວ` };

  await prisma.$executeRawUnsafe(
    `insert into app_car_vehicle_types (name, is_active, created_at, updated_at)
     values ($1, true, now(), now())`,
    name,
  );
  revalidatePath("/fleet/vehicles");
  return { ok: true };
}

/** ປ່ຽນຊື່ / ເປີດ-ປິດ ປະເພດລົດ */
export async function updateVehicleType(form: FormData): Promise<EditState> {
  await requireRole("ADMIN", "HR");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const isActive = form.get("isActive") === "on";
  if (!/^\d+$/.test(id)) return { ok: false, error: "ລະຫັດປະເພດບໍ່ຖືກຕ້ອງ" };
  if (!name) return { ok: false, error: "ຕ້ອງໃສ່ຊື່ປະເພດ" };

  await prisma.carVehicleType.update({ where: { id: BigInt(id) }, data: { name, isActive } });
  revalidatePath("/fleet/vehicles");
  return { ok: true };
}

export async function applyGpsVehicles(plan: SyncPlan): Promise<ApplyState> {
  await requireRole("ADMIN");
  try {
    // ຄິດແຜນໃໝ່ຈາກຂໍ້ມູນສົດ — ກັນກໍລະນີ DB ປ່ຽນລະຫວ່າງທີ່ຜູ້ໃຊ້ເບິ່ງແຜນຢູ່
    const fresh = await planVehicleSync({
      typeId: BigInt(plan.options.typeId),
      status: plan.options.status,
      updateNames: plan.options.updateNames,
    });
    const res = await applyVehicleSync(fresh);
    revalidatePath("/fleet/vehicles");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: laoGpsErrorMessage(e) };
  }
}
