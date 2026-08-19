"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreRefuelEvents } from "@/lib/fuel-cache";

/**
 * ✅ HR/ຜູ້ຈັດການ ຕັດສິນເຫດການນ້ຳມັນ — ຢືນຢັນວ່າເຕີມແທ້ ຫຼື ບອກວ່າບໍ່ແມ່ນການເຕີມ
 * ຄຳຕັດສິນມີນ້ຳໜັກສູງກວ່າຄະແນນອັດຕະໂນມັດ (scoreRefuelEvents ອ່ານ confirm_status ກ່ອນ)
 */
export async function reviewRefuelEvent(fd: FormData): Promise<void> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const id = String(fd.get("id") ?? "").trim();
  const decision = String(fd.get("decision") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  if (!/^\d+$/.test(id)) return;
  if (decision !== "CONFIRMED" && decision !== "REJECTED" && decision !== "CLEAR") return;

  await prisma.$executeRaw`
    update hrm_vehicle_refuel_event
       set confirm_status = ${decision === "CLEAR" ? null : decision},
           confirmed_by   = ${decision === "CLEAR" ? null : session.username},
           confirmed_at   = ${decision === "CLEAR" ? null : new Date().toISOString()}::timestamptz,
           confirm_note   = ${decision === "CLEAR" ? null : note}
     where id = ${BigInt(id)}`;

  // ຄິດຄະແນນຄືນ ເພື່ອໃຫ້ confidence ສະທ້ອນຄຳຕັດສິນທັນທີ
  await scoreRefuelEvents(45);
  revalidatePath("/fleet/fuel/review");
  revalidatePath("/fleet/fuel");
  revalidatePath("/fleet/fuel/cost");
}
