"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isSaleStockBalanced, saleOrderTotal } from "@/lib/sale-trip";
import { saveUpload } from "@/lib/upload";

export type SaleTripFormState = { error?: string; success?: string };

async function audit(userId: string, action: string, tripId: string, detail: unknown) {
  await prisma.auditLog.create({
    data: { userId, action, entityType: "SaleTrip", entityId: tripId, detail: JSON.stringify(detail) },
  });
}

async function editableTrip(tripId: string) {
  const trip = await prisma.vehicleTrip.findUnique({ where: { id: tripId } });
  if (!trip || trip.tripType !== "SALE") return { error: "ບໍ່ພົບ Sale Trip ນີ້" } as const;
  if (["CLOSED", "CANCELLED"].includes(trip.workflowStatus)) return { error: "Sale Trip ນີ້ປິດແລ້ວ" } as const;
  return { trip } as const;
}

const saleSetupSchema = z.object({
  salesTarget: z.coerce.number().min(0).max(1_000_000_000_000),
});

export async function enableSaleTrip(tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = saleSetupSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ເປົ້າໝາຍຍອດຂາຍບໍ່ຖືກຕ້ອງ" };
  const trip = await prisma.vehicleTrip.findUnique({ where: { id: tripId } });
  if (!trip) return { error: "ບໍ່ພົບ Trip" };
  if (["RETURNED", "CANCELLED"].includes(trip.status)) return { error: "Trip ນີ້ສິ້ນສຸດແລ້ວ" };
  await prisma.vehicleTrip.update({ where: { id: tripId }, data: { tripType: "SALE", salesTarget: parsed.data.salesTarget, workflowStatus: trip.status } });
  await audit(session.userId, "ENABLE_SALE", tripId, parsed.data);
  revalidatePath(`/fleet/trips/${tripId}`);
  revalidatePath("/fleet/trips");
  return { success: "ປ່ຽນເປັນ Sale Trip ແລ້ວ" };
}

const customerSchema = z.object({
  customerCode: z.string().trim().max(50).optional(),
  customerName: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  sequence: z.coerce.number().int().min(1).max(999),
  latitude: z.union([z.literal(""), z.coerce.number().min(-90).max(90)]).optional(),
  longitude: z.union([z.literal(""), z.coerce.number().min(-180).max(180)]).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function addSaleTripCustomer(tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = customerSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດຂໍ້ມູນລູກຄ້າ" };
  const editable = await editableTrip(tripId);
  if ("error" in editable) return editable;
  const value = parsed.data;
  const customer = await prisma.saleTripCustomer.create({ data: { tripId, customerCode: value.customerCode || null, customerName: value.customerName, phone: value.phone || null, address: value.address || null, sequence: value.sequence, latitude: value.latitude === "" ? null : value.latitude, longitude: value.longitude === "" ? null : value.longitude, note: value.note || null } });
  await audit(session.userId, "ADD_CUSTOMER", tripId, { customerId: customer.id, name: customer.customerName });
  revalidatePath(`/fleet/trips/${tripId}`);
  return { success: "ເພີ່ມລູກຄ້າແລ້ວ" };
}

export async function updateSaleTripCustomer(customerId: string, tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = customerSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດຂໍ້ມູນລູກຄ້າ" };
  const editable = await editableTrip(tripId);
  if ("error" in editable) return editable;
  const value = parsed.data;
  await prisma.saleTripCustomer.updateMany({
    where: { id: customerId, tripId },
    data: { customerCode: value.customerCode || null, customerName: value.customerName, phone: value.phone || null, address: value.address || null, sequence: value.sequence, latitude: value.latitude === "" ? null : value.latitude, longitude: value.longitude === "" ? null : value.longitude, note: value.note || null },
  });
  await audit(session.userId, "UPDATE_CUSTOMER", tripId, { customerId, name: value.customerName });
  revalidatePath(`/fleet/trips/${tripId}`);
  return { success: "ແກ້ໄຂລູກຄ້າແລ້ວ" };
}

const productSchema = z.object({
  productCode: z.string().trim().min(1).max(80),
  productName: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(30).optional(),
  unitPrice: z.coerce.number().min(0),
  loadedQty: z.coerce.number().positive(),
});

export async function updateSaleTripProduct(productId: string, tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = productSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດລະຫັດ, ຊື່, ລາຄາ ແລະຈຳນວນສິນຄ້າ" };
  const editable = await editableTrip(tripId);
  if ("error" in editable) return editable;
  if (editable.trip.workflowStatus !== "PLANNED") return { error: "ແກ້ໄຂສິນຄ້າໄດ້ກ່ອນອອກ Trip ເທົ່ານັ້ນ" };
  try {
    await prisma.saleTripProduct.updateMany({ where: { id: productId, tripId }, data: { ...parsed.data, unit: parsed.data.unit || null } });
    await audit(session.userId, "UPDATE_PRODUCT", tripId, { productId, code: parsed.data.productCode });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { error: "ສິນຄ້ານີ້ມີໃນ Trip ແລ້ວ" };
    throw error;
  }
  revalidatePath(`/fleet/trips/${tripId}`);
  return { success: "ແກ້ໄຂສິນຄ້າແລ້ວ" };
}

export async function addSaleTripProduct(tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = productSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດລະຫັດ, ຊື່, ລາຄາ ແລະຈຳນວນສິນຄ້າ" };
  const editable = await editableTrip(tripId);
  if ("error" in editable) return editable;
  if (editable.trip.workflowStatus !== "PLANNED") return { error: "ເພີ່ມສິນຄ້າໄດ້ກ່ອນອອກ Trip ເທົ່ານັ້ນ" };
  try {
    const product = await prisma.saleTripProduct.create({ data: { tripId, ...parsed.data, unit: parsed.data.unit || null } });
    await audit(session.userId, "LOAD_PRODUCT", tripId, { productId: product.id, code: product.productCode, qty: Number(product.loadedQty) });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { error: "ສິນຄ້ານີ້ມີໃນ Trip ແລ້ວ" };
    throw error;
  }
  revalidatePath(`/fleet/trips/${tripId}`);
  return { success: "ເພີ່ມສິນຄ້າຂຶ້ນລົດແລ້ວ" };
}

const orderSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().trim().min(1).max(200),
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  paymentType: z.enum(["CASH", "TRANSFER", "QR", "CREDIT"]),
  paidAmount: z.coerce.number().min(0).default(0),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function createSaleTripOrder(tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = orderSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດລູກຄ້າ, ສິນຄ້າ, ຈຳນວນ ແລະການຊຳລະ" };
  const editable = await editableTrip(tripId);
  if ("error" in editable) return editable;
  if (!['DEPARTED', 'IN_PROGRESS'].includes(editable.trip.workflowStatus)) return { error: "ບັນທຶກການຂາຍໄດ້ຫຼັງອອກ Trip ເທົ່ານັ້ນ" };
  const value = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sale-product:${value.productId}`}, 0))`;
    const product = await tx.saleTripProduct.findFirst({ where: { id: value.productId, tripId } });
    if (!product) return { error: "ບໍ່ພົບສິນຄ້າ" } as const;
    const available = Number(product.loadedQty) - Number(product.soldQty) - Number(product.sampleQty) - Number(product.damagedQty);
    if (value.quantity > available) return { error: `ສິນຄ້າເຫຼືອພຽງ ${available}` } as const;
    const subtotal = Math.round(value.quantity * value.unitPrice);
    const total = saleOrderTotal(value.quantity, value.unitPrice, value.discount);
    if (value.paidAmount > total) return { error: "ຍອດຮັບເງິນເກີນຍອດຂາຍ" } as const;
    const order = await tx.saleTripOrder.create({ data: { orderNo: `SO-${Date.now().toString(36).toUpperCase()}`, tripId, customerId: value.customerId || null, customerName: value.customerName, paymentType: value.paymentType, subtotal, discount: value.discount, total, paidAmount: value.paidAmount, note: value.note || null, items: { create: [{ productCode: product.productCode, productName: product.productName, unit: product.unit, quantity: value.quantity, unitPrice: value.unitPrice, discount: value.discount, total }] } } });
    await tx.saleTripProduct.update({ where: { id: product.id }, data: { soldQty: { increment: value.quantity } } });
    if (value.paidAmount > 0) await tx.saleTripPayment.create({ data: { tripId, orderId: order.id, method: value.paymentType, amount: value.paidAmount, reference: value.reference || null } });
    await tx.vehicleTrip.update({ where: { id: tripId }, data: { workflowStatus: "IN_PROGRESS" } });
    return { order, total };
  });
  if ("error" in result) return { error: result.error };
  await audit(session.userId, "CREATE_ORDER", tripId, { orderId: result.order.id, orderNo: result.order.orderNo, total: result.total });
  revalidatePath(`/fleet/trips/${tripId}`);
  return { success: `ບັນທຶກການຂາຍ ${result.order.orderNo} ແລ້ວ` };
}

const expenseSchema = z.object({ type: z.string().trim().min(1).max(80), amount: z.coerce.number().positive(), note: z.string().trim().max(500).optional(), receiptUrl: z.string().trim().max(1000).optional() });
export async function addSaleTripExpense(tripId: string, _prev: SaleTripFormState, fd: FormData): Promise<SaleTripFormState> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = expenseSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດປະເພດ ແລະຈຳນວນເງິນ" };
  const editable = await editableTrip(tripId);
  if ("error" in editable) return editable;
  const expense = await prisma.saleTripExpense.create({ data: { tripId, ...parsed.data, note: parsed.data.note || null, receiptUrl: parsed.data.receiptUrl || null, submittedByCode: session.employeeCode } });
  await audit(session.userId, "ADD_EXPENSE", tripId, { expenseId: expense.id, type: expense.type, amount: Number(expense.amount) });
  revalidatePath(`/fleet/trips/${tripId}`);
  return { success: "ເພີ່ມຄ່າໃຊ້ຈ່າຍແລ້ວ" };
}

const reconcileSchema = z.object({ sampleQty: z.coerce.number().min(0), returnedQty: z.coerce.number().min(0), damagedQty: z.coerce.number().min(0) });
export async function reconcileSaleTripProduct(productId: string, tripId: string, fd: FormData) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const parsed = reconcileSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return;
  const product = await prisma.saleTripProduct.findFirst({ where: { id: productId, tripId }, select: { loadedQty: true, soldQty: true } });
  if (!product) return;
  const accounted = Number(product.soldQty) + parsed.data.sampleQty + parsed.data.returnedQty + parsed.data.damagedQty;
  if (Math.abs(accounted - Number(product.loadedQty)) > 0.0001) return;
  await prisma.saleTripProduct.update({ where: { id: productId }, data: parsed.data });
  await audit(session.userId, "RECONCILE_PRODUCT", tripId, { productId, ...parsed.data });
  revalidatePath(`/fleet/trips/${tripId}`);
}

export async function deleteSaleTripCustomer(customerId: string, tripId: string) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const editable = await editableTrip(tripId);
  if ("error" in editable) return;
  await prisma.saleTripCustomer.deleteMany({ where: { id: customerId, tripId } });
  await audit(session.userId, "DELETE_CUSTOMER", tripId, { customerId });
  revalidatePath(`/fleet/trips/${tripId}`);
}

export async function deleteSaleTripProduct(productId: string, tripId: string) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const editable = await editableTrip(tripId);
  if ("error" in editable) return;
  if (editable.trip.workflowStatus !== "PLANNED") return; // ລຶບໄດ້ກ່ອນອອກ Trip ເທົ່ານັ້ນ
  await prisma.saleTripProduct.deleteMany({ where: { id: productId, tripId } });
  await audit(session.userId, "DELETE_PRODUCT", tripId, { productId });
  revalidatePath(`/fleet/trips/${tripId}`);
}

export async function advanceSaleTrip(tripId: string, next: "DEPARTED" | "RETURNED" | "CLOSED", fd: FormData) {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const trip = await prisma.vehicleTrip.findUnique({ where: { id: tripId }, include: { saleProducts: true } });
  if (!trip || trip.tripType !== "SALE") return;
  const current = trip.workflowStatus;
  if (next === "DEPARTED" && current !== "PLANNED") return;
  if (next === "RETURNED" && !["DEPARTED", "IN_PROGRESS"].includes(current)) return;
  if (next === "CLOSED" && current !== "RETURNED") return;
  const odometer = Number(fd.get("odometer"));
  if (!Number.isInteger(odometer) || odometer < 0) return;
  if (next !== "DEPARTED" && trip.openingOdometer != null && odometer < trip.openingOdometer) return;
  if (next === "DEPARTED" && (!trip.vehicleId || !trip.driverCode)) return;
  if (next === "CLOSED") {
    const unbalanced = trip.saleProducts.some((p) => !isSaleStockBalanced({ loadedQty: Number(p.loadedQty), soldQty: Number(p.soldQty), sampleQty: Number(p.sampleQty), returnedQty: Number(p.returnedQty), damagedQty: Number(p.damagedQty) }));
    if (unbalanced) return;
  }
  // ຮູບຮັບ/ສົ່ງລົດ (ຖ້າແນບມາ)
  let photoUrl: string | null = null;
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveUpload(photo, `trips/${tripId}`);
    if (saved.error) return;
    photoUrl = saved.url ?? null;
  }

  const now = new Date();
  const data = next === "DEPARTED"
    ? { workflowStatus: next, status: "DEPARTED" as const, openingOdometer: odometer, openingFuel: Number(fd.get("fuel")) || null, startedAt: now, ...(photoUrl ? { departurePhotoUrl: photoUrl } : {}) }
    : next === "RETURNED"
      ? { workflowStatus: next, status: "RETURNED" as const, closingOdometer: odometer, closingFuel: Number(fd.get("fuel")) || null, returnedAt: now, ...(photoUrl ? { returnPhotoUrl: photoUrl } : {}) }
      : { workflowStatus: next, closedAt: now };
  await prisma.vehicleTrip.update({ where: { id: tripId }, data });
  await audit(session.userId, next, tripId, { odometer, fuel: fd.get("fuel") });
  revalidatePath(`/fleet/trips/${tripId}`);
  revalidatePath("/fleet/trips");
}
