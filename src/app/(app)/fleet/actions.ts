"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth";
import { currentStepInfo, canApproveCurrentStep, canApproveStep } from "@/lib/trip-approvals";
import type { TripStatus } from "@/generated/prisma/client";
import { isValidTripTimeRange } from "@/lib/trip";
import { ACTIVE_EMPLOYEE } from "@/lib/employee-status";

export type FleetFormState = { error?: string };

function validTime(value: string) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function logTrip(userId: string, action: string, id: string, detail?: unknown) {
  await prisma.auditLog.create({ data: { userId, action, entityType: "VehicleTrip", entityId: id, detail: detail == null ? null : JSON.stringify(detail) } });
}

// ລົດຈັດການຢູ່ລະບົບ ERP (app_car_vehicles) — HRM ອ່ານຢ່າງດຽວ, ບໍ່ມີ create/toggle ທີ່ນີ້.

// ── ແຜນ/trip (ADMIN/HR/MANAGER) ──
export async function createTrip(_prev: FleetFormState, fd: FormData): Promise<FleetFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const dateStr = String(fd.get("date") ?? "");
  const endDateStr = String(fd.get("endDate") ?? "");
  const vehicleId = String(fd.get("vehicleId") ?? "");
  const destination = String(fd.get("destination") ?? "").trim();
  const tripType = fd.get("tripType") === "SALE" ? "SALE" : "GENERAL";
  const salesTarget = Number(fd.get("salesTarget") ?? 0);
  const departTime = String(fd.get("departTime") ?? "").trim();
  const returnTime = String(fd.get("returnTime") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "ວັນທີບໍ່ຖືກຕ້ອງ" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return { error: "ວັນສິ້ນສຸດບໍ່ຖືກຕ້ອງ" };
  if (!/^\d+$/.test(vehicleId)) return { error: "ເລືອກລົດ" };
  const vehicle = await prisma.carVehicle.findUnique({ where: { id: BigInt(vehicleId) } });
  if (!vehicle || vehicle.status === "retired") return { error: "ບໍ່ພົບລົດ ຫຼືລົດຖືກປົດລະວາງ" };
  if (!destination) return { error: "ໃສ່ຕະຫຼາດ/ເສັ້ນທາງ" };
  if (!Number.isFinite(salesTarget) || salesTarget < 0) return { error: "ເປົ້າໝາຍຍອດຂາຍບໍ່ຖືກຕ້ອງ" };
  if (!departTime || !returnTime || !validTime(departTime) || !validTime(returnTime)) return { error: "ກະລຸນາໃສ່ເວລາເລີ່ມ–ສິ້ນສຸດ" };

  const members = [...new Set(fd.getAll("member").map(String))].filter(Boolean);
  const driverCode = String(fd.get("driverCode") ?? "").trim() || null;
  // ຮ້ານຄ້າທີ່ຈະໄປ (ຈາກ ar_customer) — hidden input "shop" = "code|name"
  const shopEntries = fd.getAll("shop").map(String).map((s) => {
    const i = s.indexOf("|");
    return i > 0 ? { code: s.slice(0, i), name: s.slice(i + 1) } : null;
  }).filter((x): x is { code: string; name: string } => !!x);
  const shops = [...new Map(shopEntries.map((s) => [s.code, s])).values()];
  const date = new Date(`${dateStr}T00:00:00Z`);
  const endDate = new Date(`${endDateStr}T00:00:00Z`);
  if (endDate < date) return { error: "ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມ" };
  if (!isValidTripTimeRange(date, endDate, departTime, returnTime)) return { error: "ເວລາສິ້ນສຸດຕ້ອງຫຼັງເວລາເລີ່ມ" };

  const employeeCodes = [...new Set([...members, ...(driverCode ? [driverCode] : [])])];
  if (employeeCodes.length) {
    const activeCount = await prisma.employee.count({ where: { code: { in: employeeCodes }, ...ACTIVE_EMPLOYEE } });
    if (activeCount !== employeeCodes.length) return { error: "ຄົນຂັບ ຫຼືພະນັກງານບາງຄົນບໍ່ active" };
  }

  const overlaps = await prisma.vehicleTrip.findMany({
    where: { vehicleId, status: { not: "CANCELLED" }, date: { lte: endDate }, endDate: { gte: date } },
    select: { date: true, endDate: true, tripNo: true },
  });
  // auto tripNo: ຕໍ່ຈາກເລກສູງສຸດຂອງລົດຄັນນີ້ໃນຊ່ວງວັນທີ
  const tripNo = overlaps.length ? Math.max(...overlaps.map((t) => t.tripNo)) + 1 : 1;
  const multiDay = endDate.getTime() !== date.getTime();
  const conflict = overlaps.some((trip) => multiDay || trip.endDate.getTime() !== trip.date.getTime() || trip.tripNo === tripNo);
  if (conflict) return { error: "ລົດນີ້ມີ Trip ທັບຊ້ອນຊ່ວງວັນທີນີ້ແລ້ວ" };
  if (employeeCodes.length) {
    const employeeOverlaps = await prisma.vehicleTrip.findMany({
      where: {
        status: { not: "CANCELLED" },
        date: { lte: endDate },
        endDate: { gte: date },
        OR: [{ driverCode: { in: employeeCodes } }, { members: { some: { employeeCode: { in: employeeCodes } } } }],
      },
      select: { date: true, endDate: true, tripNo: true },
    });
    const employeeConflict = employeeOverlaps.some((trip) => multiDay || trip.endDate.getTime() !== trip.date.getTime() || trip.tripNo === tripNo);
    if (employeeConflict) return { error: "ຄົນຂັບ ຫຼືພະນັກງານມີ Trip ທັບຊ້ອນຊ່ວງນີ້ແລ້ວ" };
  }

  try {
    const trip = await prisma.vehicleTrip.create({ data: {
      date,
      endDate,
      tripNo,
      vehicleId,
      driverCode,
      destination,
      departTime: departTime || null,
      returnTime: returnTime || null,
      note: String(fd.get("note") ?? "").trim() || null,
      tripType,
      salesTarget,
      createdByUserId: session.userId,
      // admin ສ້າງໂດຍກົງ = ອະນຸມັດ + ຈັດລົດແລ້ວທັນທີ
      approvedAt: new Date(),
      approvedByUserId: session.userId,
      members: { create: members.map((employeeCode) => ({ employeeCode })) },
      saleCustomers: shops.length ? { create: shops.map((s, i) => ({ sequence: i + 1, customerCode: s.code, customerName: s.name })) } : undefined,
    } });
    await logTrip(session.userId, "CREATE", trip.id, { date: dateStr, endDate: endDateStr, tripNo, vehicleId, tripType });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { error: `ລົດນີ້ມີ Trip ${tripNo} ທັບຊ້ອນແລ້ວ` };
    throw error;
  }
  revalidatePath("/fleet/trips");
  revalidatePath("/fleet/daily-slip");
  // ສ້າງຈາກໜ້າໃບນຳໃຊ້ລົດ → ກັບໄປໜ້ານັ້ນ ຈຶ່ງເຫັນໃບທີ່ອອກມາທັນທີ
  const returnTo = fd.get("returnTo") === "daily-slip" ? "/fleet/daily-slip" : "/fleet/trips";
  redirect(`${returnTo}?date=${dateStr}`);
}

// ── ຈັດລົດ + ອະນຸມັດຄຳຮ້ອງຈາກ LINE (ADMIN/HR/MANAGER) ──
export async function assignTripVehicle(tripId: string, _prev: FleetFormState, fd: FormData): Promise<FleetFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const vehicleId = String(fd.get("vehicleId") ?? "");
  const driverCode = String(fd.get("driverCode") ?? "").trim() || null;
  const tripNoRaw = Number(fd.get("tripNo"));

  if (!/^\d+$/.test(vehicleId)) return { error: "ເລືອກລົດ" };
  const [trip, vehicle] = await Promise.all([
    prisma.vehicleTrip.findUnique({ where: { id: tripId }, include: { members: { select: { employeeCode: true } } } }),
    prisma.carVehicle.findUnique({ where: { id: BigInt(vehicleId) } }),
  ]);
  if (!trip) return { error: "ບໍ່ພົບ trip" };
  // Sale trip: ແຜນຖືກອະນຸມັດຢູ່ລະບົບ SALE (ຜູ້ຈັດການຝ່າຍຂາຍ) — HRM ເຮັດສະເພາະ "ປ່ອຍລົດ"
  // ຈຶ່ງບໍ່ອີງ chain ຂອງ HRM ແລະ ບໍ່ຕິດ approvedAt (ທີ່ SALE ຕັ້ງກ່ອນແລ້ວ)
  const isSale = trip.tripType === "SALE";
  if (trip.status === "CANCELLED") return { error: "Trip ນີ້ຖືກຍົກເລີກແລ້ວ" };
  if (isSale) {
    if (trip.workflowStatus !== "PLANNED") return { error: "Trip ອອກເດີນທາງແລ້ວ ປ່ຽນລົດບໍ່ໄດ້" };
    if (trip.vehicleId && trip.vehicleApprovedAt) return { error: "ປ່ອຍລົດໃຫ້ Trip ນີ້ແລ້ວ" };
  } else {
    if (trip.approvedAt) return { error: "Trip ນີ້ຖືກຈັດການແລ້ວ" };
    // ຄຳຮ້ອງຈາກພະນັກງານ → ຕ້ອງອະນຸມັດຄົບທຸກຂັ້ນກ່ອນ ຈຶ່ງຈັດລົດໄດ້
    if (trip.requestedByCode) {
      const { done } = await currentStepInfo(trip);
      if (!done) return { error: "ຍັງອະນຸມັດບໍ່ຄົບທຸກຂັ້ນ" };
    }
  }
  if (!vehicle || vehicle.status === "retired") return { error: "ບໍ່ພົບລົດ ຫຼືລົດຖືກປົດລະວາງ" };
  if (driverCode) {
    const driver = await prisma.employee.findFirst({ where: { code: driverCode, ...ACTIVE_EMPLOYEE }, select: { code: true } });
    if (!driver) return { error: "ຄົນຂັບບໍ່ active" };
  }

  const tripNo = Number.isInteger(tripNoRaw) && tripNoRaw >= 1 ? tripNoRaw : trip.tripNo;
  const overlaps = await prisma.vehicleTrip.findMany({
    where: { vehicleId, id: { not: tripId }, status: { not: "CANCELLED" }, date: { lte: trip.endDate }, endDate: { gte: trip.date } },
    select: { id: true, date: true, endDate: true, tripNo: true },
  });
  const multiDay = trip.endDate.getTime() !== trip.date.getTime();
  const conflict = overlaps.some((row) => multiDay || row.endDate.getTime() !== row.date.getTime() || row.tripNo === tripNo);
  if (conflict) return { error: "ລົດນີ້ມີ Trip ທັບຊ້ອນຊ່ວງວັນທີນີ້ແລ້ວ" };
  const participantCodes = [...new Set([...trip.members.map((member) => member.employeeCode), ...(driverCode ? [driverCode] : [])])];
  if (participantCodes.length) {
    const employeeOverlaps = await prisma.vehicleTrip.findMany({
      where: {
        id: { not: tripId },
        status: { not: "CANCELLED" },
        date: { lte: trip.endDate },
        endDate: { gte: trip.date },
        OR: [{ driverCode: { in: participantCodes } }, { members: { some: { employeeCode: { in: participantCodes } } } }],
      },
      select: { date: true, endDate: true, tripNo: true },
    });
    const employeeConflict = employeeOverlaps.some((row) => multiDay || row.endDate.getTime() !== row.date.getTime() || row.tripNo === tripNo);
    if (employeeConflict) return { error: "ຄົນຂັບ ຫຼືພະນັກງານມີ Trip ທັບຊ້ອນຊ່ວງນີ້ແລ້ວ" };
  }

  await prisma.vehicleTrip.update({
    where: { id: tripId },
    data: isSale
      ? {
          // ປ່ອຍລົດ: ຕັ້ງ vehicle_approved_* — SALE ອ່ານຄ່ານີ້ເປັນ "ພ້ອມອອກເດີນທາງ"
          // approvedAt ຂອງແຜນປ່ອຍໃຫ້ SALE ຄຸມ (ບໍ່ທັບ)
          vehicleId,
          driverCode,
          tripNo,
          vehicleApprovedAt: new Date(),
          vehicleApprovedBy: session.employeeCode ?? session.userId,
          vehicleRejectReason: null,
        }
      : {
          vehicleId,
          driverCode,
          tripNo,
          status: "PLANNED",
          workflowStatus: "PLANNED",
          approvedAt: new Date(),
          approvedByUserId: session.userId,
          rejectReason: null,
        },
  });
  await logTrip(session.userId, isSale ? "RELEASE_VEHICLE" : "APPROVE_AND_ASSIGN", tripId, { vehicleId, driverCode, tripNo });
  revalidatePath("/fleet/trips");
  return {};
}

/**
 * Sale trip: HRM ບໍ່ປ່ອຍລົດ — ບໍ່ຍົກເລີກ trip (ແຜນຂາຍຍັງຢູ່) ພຽງແຕ່ໃສ່ເຫດຜົນ
 * SALE ຈະສະແດງເຫດຜົນນີ້ໃຫ້ພະນັກງານ ແລະ ຂໍໃໝ່ / ໃຊ້ລົດຕົນເອງໄດ້
 */
export async function rejectSaleVehicle(id: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id }, select: { tripType: true, status: true, vehicleApprovedAt: true } });
  if (!trip || trip.tripType !== "SALE" || trip.status === "CANCELLED" || trip.vehicleApprovedAt) return;
  const reason = String(formData.get("reason") ?? "").trim() || "HRM ບໍ່ສາມາດຈັດລົດໃຫ້ໄດ້";
  await prisma.vehicleTrip.update({ where: { id }, data: { vehicleRejectReason: reason, vehicleId: null } });
  await logTrip(session.userId, "REJECT_VEHICLE", id, { reason });
  revalidatePath("/fleet/trips");
}

// ອະນຸມັດ 1 ຂັ້ນ (ຕາມ chain) — ຜູ້ອະນຸມັດຂອງຂັ້ນນັ້ນ ຫຼື ADMIN/HR
export async function approveTripStep(id: string) {
  const session = await requireUser();
  const trip = await prisma.vehicleTrip.findUnique({ where: { id } });
  if (!trip || trip.approvedAt || trip.status === "CANCELLED" || !trip.requestedByCode) return;
  const info = await currentStepInfo(trip);
  if (info.done || !canApproveStep(session, info.approvers)) return;
  await prisma.vehicleTrip.update({ where: { id }, data: { approvalLevel: { increment: 1 } } });
  await logTrip(session.userId, "APPROVE_STEP", id, { level: trip.approvalLevel + 1, of: info.totalSteps });
  revalidatePath("/fleet/trips");
}

export async function rejectTrip(id: string, formData: FormData) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id } });
  if (!trip || trip.approvedAt) return;
  if (trip.requestedByCode && !(await canApproveCurrentStep(session, trip))) return;
  const reason = String(formData.get("reason") ?? "").trim();
  await prisma.vehicleTrip.update({
    where: { id },
    data: { status: "CANCELLED", workflowStatus: "CANCELLED", rejectReason: reason || "ຄຳຮ້ອງຖືກປະຕິເສດ" },
  });
  await logTrip(session.userId, "REJECT", id, { reason });
  revalidatePath("/fleet/trips");
}

export async function updateTripStatus(id: string, status: TripStatus) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id } });
  if (!trip) return;
  const allowed: Record<TripStatus, TripStatus[]> = { PLANNED: ["DEPARTED", "CANCELLED"], DEPARTED: ["RETURNED", "CANCELLED"], RETURNED: [], CANCELLED: [] };
  if (!allowed[trip.status].includes(status)) return;
  await prisma.vehicleTrip.update({ where: { id }, data: { status, workflowStatus: status, startedAt: status === "DEPARTED" ? new Date() : undefined, returnedAt: status === "RETURNED" ? new Date() : undefined } });
  await logTrip(session.userId, status, id, { from: trip.status, to: status });
  revalidatePath("/fleet/trips");
}

export async function deleteTrip(id: string) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id }, select: { approvedAt: true, status: true } });
  if (!trip || trip.approvedAt || trip.status !== "CANCELLED") return;
  await logTrip(session.userId, "DELETE_REJECTED_REQUEST", id, trip);
  await prisma.vehicleTrip.delete({ where: { id } });
  revalidatePath("/fleet/trips");
}

// ── ແກ້ໄຂ / ລົບ Trip ທັງໝົດ (ADMIN/HR/MANAGER) ──

export async function updateTrip(tripId: string, _prev: FleetFormState, fd: FormData): Promise<FleetFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id: tripId }, select: { id: true, tripNo: true, workflowStatus: true, status: true } });
  if (!trip) return { error: "ບໍ່ພົບ Trip" };
  if (trip.workflowStatus === "CLOSED" || trip.status === "CANCELLED") return { error: "ບໍ່ສາມາດແກ້ໄຂ Trip ທີ່ປິດ/ຍົກເລີກແລ້ວ" };

  const dateStr = String(fd.get("date") ?? "");
  const endDateStr = String(fd.get("endDate") ?? "");
  const vehicleId = String(fd.get("vehicleId") ?? "");
  const destination = String(fd.get("destination") ?? "").trim();
  const departTime = String(fd.get("departTime") ?? "").trim();
  const returnTime = String(fd.get("returnTime") ?? "").trim();
  const driverCode = String(fd.get("driverCode") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "ວັນທີບໍ່ຖືກຕ້ອງ" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return { error: "ວັນສິ້ນສຸດບໍ່ຖືກຕ້ອງ" };
  if (!/^\d+$/.test(vehicleId)) return { error: "ເລືອກລົດ" };
  const vehicle = await prisma.carVehicle.findUnique({ where: { id: BigInt(vehicleId) } });
  if (!vehicle || vehicle.status === "retired") return { error: "ບໍ່ພົບລົດ ຫຼືລົດຖືກປົດລະວາງ" };
  if (!destination) return { error: "ໃສ່ຕະຫຼາດ/ເສັ້ນທາງ" };
  if (!departTime || !returnTime || !validTime(departTime) || !validTime(returnTime)) return { error: "ກະລຸນາໃສ່ເວລາເລີ່ມ–ສິ້ນສຸດ" };

  const date = new Date(`${dateStr}T00:00:00Z`);
  const endDate = new Date(`${endDateStr}T00:00:00Z`);
  if (endDate < date) return { error: "ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມ" };
  if (!isValidTripTimeRange(date, endDate, departTime, returnTime)) return { error: "ເວລາສິ້ນສຸດຕ້ອງຫຼັງເວລາເລີ່ມ" };

  if (driverCode) {
    const active = await prisma.employee.count({ where: { code: driverCode, ...ACTIVE_EMPLOYEE } });
    if (active !== 1) return { error: "ຄົນຂັບບໍ່ active" };
  }

  // ກວດ Trip ທັບຊ້ອນຂອງລົດ (ຍົກເວັ້ນ Trip ນີ້ເອງ)
  const overlaps = await prisma.vehicleTrip.findMany({
    where: { id: { not: tripId }, vehicleId, status: { not: "CANCELLED" }, date: { lte: endDate }, endDate: { gte: date } },
    select: { date: true, endDate: true, tripNo: true },
  });
  const multiDay = endDate.getTime() !== date.getTime();
  if (overlaps.some((t) => multiDay || t.endDate.getTime() !== t.date.getTime() || t.tripNo === trip.tripNo)) {
    return { error: "ລົດນີ້ມີ Trip ທັບຊ້ອນຊ່ວງວັນທີນີ້ແລ້ວ" };
  }

  try {
    await prisma.vehicleTrip.update({ where: { id: tripId }, data: { date, endDate, vehicleId, driverCode, destination, departTime: departTime || null, returnTime: returnTime || null, note: String(fd.get("note") ?? "").trim() || null } });
    await logTrip(session.userId, "UPDATE", tripId, { date: dateStr, endDate: endDateStr, vehicleId });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { error: "ລົດນີ້ມີ Trip ທັບຊ້ອນແລ້ວ" };
    throw error;
  }
  revalidatePath(`/fleet/trips/${tripId}`);
  revalidatePath("/fleet/trips");
  return {};
}

/** ລົບ Trip ທັງໝົດ (ພ້ອມຂໍ້ມູນຂາຍ/ຮ້ານ/ຄ່າໃຊ້ຈ່າຍ ຜ່ານ cascade) */
export async function removeTrip(tripId: string) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id: tripId }, select: { id: true, tripNo: true, destination: true, status: true, workflowStatus: true } });
  if (!trip) return;
  await logTrip(session.userId, "DELETE_TRIP", tripId, trip);
  await prisma.vehicleTrip.delete({ where: { id: tripId } });
  revalidatePath("/fleet/trips");
  revalidatePath("/fleet/daily-slip");
  redirect("/fleet/trips");
}
