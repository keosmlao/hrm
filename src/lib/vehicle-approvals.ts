import "server-only";
import { prisma } from "./prisma";
import { getApprovalSteps } from "./trip-approvals";
import type { SessionPayload } from "./jwt";

/** ລະຫັດຜູ້ມີສິດອະນຸມັດລົດ (global) */
export async function getVehicleApproverCodes(): Promise<Set<string>> {
  const rows = await prisma.vehicleApprover.findMany({ select: { employeeCode: true } });
  return new Set(rows.map((r) => r.employeeCode));
}

/** ພະນັກງານຄົນນີ້ ອະນຸມັດລົດໄດ້ບໍ (ຢູ່ໃນລາຍການ) */
export async function isVehicleApprover(code: string): Promise<boolean> {
  return !!(await prisma.vehicleApprover.findUnique({ where: { employeeCode: code }, select: { employeeCode: true } }));
}

/** session ອະນຸມັດລົດໄດ້ບໍ — ADMIN/HR = super, ຫຼື ຢູ່ໃນລາຍການຜູ້ອະນຸມັດລົດ */
export async function canApproveVehicle(session: SessionPayload): Promise<boolean> {
  if (["ADMIN", "HR"].includes(session.role)) return true;
  return !!session.employeeCode && (await isVehicleApprover(session.employeeCode));
}

/** ຄົບ "ແຜນ" (chain) ບໍ */
export async function isPlanApproved(trip: { approvalLevel: number }): Promise<boolean> {
  const steps = await getApprovalSteps();
  return trip.approvalLevel >= steps.length;
}

/**
 * ຖ້າຄົບ ທັງ ແຜນ (chain) ແລະ ລົດ (vehicleApprovedAt) → ຕັ້ງ approvedAt = ຢືນຢັນ.
 * ຄືນ true ຖ້າຕັ້ງ approvedAt ໃນຮອບນີ້.
 */
export async function finalizeTripApproval(tripId: string, approvedByUserId?: string | null): Promise<boolean> {
  const trip = await prisma.vehicleTrip.findUnique({
    where: { id: tripId },
    select: { approvalLevel: true, vehicleApprovedAt: true, approvedAt: true, requestedByCode: true, status: true },
  });
  if (!trip || trip.approvedAt || trip.status === "CANCELLED" || !trip.requestedByCode) return false;
  if (!trip.vehicleApprovedAt) return false;
  if (!(await isPlanApproved(trip))) return false;
  await prisma.vehicleTrip.update({ where: { id: tripId }, data: { approvedAt: new Date(), approvedByUserId: approvedByUserId ?? null } });
  return true;
}
