"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import {
  addSaleTripCustomer,
  addSaleTripExpense,
  addSaleTripProduct,
  createSaleTripOrder,
  enableSaleTrip,
  type SaleTripFormState,
} from "./sale-actions";

function Message({ state }: { state: SaleTripFormState }) {
  if (!state.error && !state.success) return null;
  return <p className={`text-xs ${state.error ? "text-rose-600" : "text-emerald-700"}`}>{state.error ?? state.success}</p>;
}

export function EnableSaleTripForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(enableSaleTrip.bind(null, tripId), {});
  return <form action={action} className="flex flex-wrap items-end gap-3"><label className="text-sm">ເປົ້າໝາຍຍອດຂາຍ<input name="salesTarget" type="number" min="0" defaultValue="0" className={`${inputClass} mt-1`} /></label><Button disabled={pending}>{pending ? "..." : "ເປີດໃຊ້ Sale Trip"}</Button><Message state={state} /></form>;
}

export function SaleCustomerForm({ tripId, sequence }: { tripId: string; sequence: number }) {
  const [state, action, pending] = useActionState(addSaleTripCustomer.bind(null, tripId), {});
  return <form action={action} className="grid gap-2 md:grid-cols-4"><input name="sequence" type="number" min="1" defaultValue={sequence} placeholder="ລຳດັບ" className={inputClass} /><input name="customerCode" placeholder="ລະຫັດລູກຄ້າ" className={inputClass} /><input name="customerName" required placeholder="ຊື່ລູກຄ້າ *" className={inputClass} /><input name="phone" placeholder="ເບີໂທ" className={inputClass} /><input name="address" placeholder="ທີ່ຢູ່/ເສັ້ນທາງ" className={`${inputClass} md:col-span-2`} /><input name="latitude" type="number" step="any" placeholder="Latitude" className={inputClass} /><input name="longitude" type="number" step="any" placeholder="Longitude" className={inputClass} /><input name="note" placeholder="ໝາຍເຫດ" className={`${inputClass} md:col-span-3`} /><Button disabled={pending}>{pending ? "..." : "+ ລູກຄ້າ"}</Button><div className="md:col-span-4"><Message state={state} /></div></form>;
}

export function SaleProductForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addSaleTripProduct.bind(null, tripId), {});
  return <form action={action} className="grid gap-2 md:grid-cols-5"><input name="productCode" required placeholder="ລະຫັດສິນຄ້າ *" className={inputClass} /><input name="productName" required placeholder="ຊື່ສິນຄ້າ *" className={inputClass} /><input name="unit" placeholder="ໜ່ວຍ" className={inputClass} /><input name="unitPrice" type="number" min="0" required placeholder="ລາຄາ" className={inputClass} /><input name="loadedQty" type="number" min="0.001" step="0.001" required placeholder="ຈຳນວນຂຶ້ນລົດ" className={inputClass} /><div className="md:col-span-4"><Message state={state} /></div><Button disabled={pending}>{pending ? "..." : "+ ສິນຄ້າ"}</Button></form>;
}

type Option = { id: string; label: string; unitPrice?: number };
export function SaleOrderForm({ tripId, customers, products }: { tripId: string; customers: Option[]; products: Option[] }) {
  const [state, action, pending] = useActionState(createSaleTripOrder.bind(null, tripId), {});
  return <form action={action} className="grid gap-2 md:grid-cols-4"><select name="customerId" className={inputClass}><option value="">— ບໍ່ຜູກລູກຄ້າ —</option>{customers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select><input name="customerName" required placeholder="ຊື່ລູກຄ້າ *" className={inputClass} /><select name="productId" required className={inputClass}><option value="">— ເລືອກສິນຄ້າ —</option>{products.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select><input name="quantity" type="number" min="0.001" step="0.001" required placeholder="ຈຳນວນ" className={inputClass} /><input name="unitPrice" type="number" min="0" required placeholder="ລາຄາ/ໜ່ວຍ" className={inputClass} /><input name="discount" type="number" min="0" defaultValue="0" placeholder="ສ່ວນຫຼຸດ" className={inputClass} /><select name="paymentType" className={inputClass}><option value="CASH">ເງິນສົດ</option><option value="TRANSFER">ໂອນ</option><option value="QR">QR</option><option value="CREDIT">ເງິນເຊື່ອ</option></select><input name="paidAmount" type="number" min="0" defaultValue="0" placeholder="ຮັບເງິນແລ້ວ" className={inputClass} /><input name="reference" placeholder="ເລກອ້າງອີງ" className={inputClass} /><input name="note" placeholder="ໝາຍເຫດ" className={`${inputClass} md:col-span-2`} /><Button disabled={pending}>{pending ? "..." : "ບັນທຶກການຂາຍ"}</Button><div className="md:col-span-4"><Message state={state} /></div></form>;
}

export function SaleExpenseForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addSaleTripExpense.bind(null, tripId), {});
  return <form action={action} className="grid gap-2 md:grid-cols-4"><select name="type" className={inputClass}><option value="FUEL">ຄ່ານ້ຳມັນ</option><option value="TOLL">ຄ່າທາງ</option><option value="FOOD">ຄ່າອາຫານ</option><option value="PARKING">ຄ່າຈອດ</option><option value="REPAIR">ຄ່າສ້ອມ</option><option value="OTHER">ອື່ນໆ</option></select><input name="amount" type="number" min="1" required placeholder="ຈຳນວນເງິນ" className={inputClass} /><input name="receiptUrl" placeholder="ລິ້ງໃບບິນ" className={inputClass} /><input name="note" placeholder="ໝາຍເຫດ" className={inputClass} /><div className="md:col-span-3"><Message state={state} /></div><Button disabled={pending}>{pending ? "..." : "+ ຄ່າໃຊ້ຈ່າຍ"}</Button></form>;
}
