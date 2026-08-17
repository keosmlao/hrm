"use client";

import { useState } from "react";
import { Badge, Button, Td, inputClass } from "@/components/ui";
import { kip, laoDateTime } from "@/lib/format";
import { isSaleStockBalanced } from "@/lib/sale-trip";
import {
  updateSaleTripCustomer,
  deleteSaleTripCustomer,
  updateSaleTripProduct,
  deleteSaleTripProduct,
  reconcileSaleTripProduct,
} from "./sale-actions";

export type SaleCustomerRowData = {
  id: string;
  sequence: number;
  customerCode: string | null;
  customerName: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  status: string;
  checkedInAt: string | null;
};

export type SaleProductRowData = {
  id: string;
  productCode: string;
  productName: string;
  unit: string | null;
  unitPrice: number;
  loadedQty: number;
  soldQty: number;
  sampleQty: number;
  returnedQty: number;
  damagedQty: number;
};

export function SaleCustomerRow({ customer, tripId, canEdit }: { customer: SaleCustomerRowData; tripId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null);
    const result = await updateSaleTripCustomer(customer.id, tripId, {}, new FormData(event.currentTarget));
    setBusy(false);
    if (result.error) setError(result.error);
    else setEditing(false);
  };

  if (editing) {
    return (
      <tr>
        <Td colSpan={7}>
          <form onSubmit={submit} className="grid gap-2 md:grid-cols-4">
            <input name="sequence" type="number" min="1" defaultValue={customer.sequence} placeholder="ລຳດັບ" className={inputClass} />
            <input name="customerCode" defaultValue={customer.customerCode ?? ""} placeholder="ລະຫັດລູກຄ້າ" className={inputClass} />
            <input name="customerName" required defaultValue={customer.customerName} placeholder="ຊື່ລູກຄ້າ *" className={inputClass} />
            <input name="phone" defaultValue={customer.phone ?? ""} placeholder="ເບີໂທ" className={inputClass} />
            <input name="address" defaultValue={customer.address ?? ""} placeholder="ທີ່ຢູ່/ເສັ້ນທາງ" className={`${inputClass} md:col-span-2`} />
            <input name="latitude" type="number" step="any" defaultValue={customer.latitude ?? ""} placeholder="Latitude" className={inputClass} />
            <input name="longitude" type="number" step="any" defaultValue={customer.longitude ?? ""} placeholder="Longitude" className={inputClass} />
            <input name="note" defaultValue={customer.note ?? ""} placeholder="ໝາຍເຫດ" className={`${inputClass} md:col-span-3`} />
            <div className="flex items-center gap-2">
              <Button disabled={busy}>{busy ? "..." : "ບັນທຶກ"}</Button>
              <button type="button" onClick={() => { setEditing(false); setError(null); }} className="text-xs text-muted hover:underline">ຍົກເລີກ</button>
            </div>
            {error && <p className="text-xs text-rose-600 md:col-span-4">{error}</p>}
          </form>
        </Td>
      </tr>
    );
  }

  return (
    <tr>
      <Td>{customer.sequence}</Td>
      <Td className="font-medium">{customer.customerCode ? `${customer.customerCode} · ` : ""}{customer.customerName}</Td>
      <Td>{customer.phone ?? "-"}</Td>
      <Td>{customer.address ?? "-"}</Td>
      <Td>
        {customer.latitude != null && customer.longitude != null
          ? <a href={`https://maps.google.com/?q=${customer.latitude},${customer.longitude}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">📍 ແຜນທີ່</a>
          : <span className="text-muted">-</span>}
        {customer.checkedInAt && <span className="block text-xs text-muted">{laoDateTime(customer.checkedInAt)}</span>}
      </Td>
      <Td>{customer.status}</Td>
      <Td>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">ແກ້ໄຂ</button>
            <form action={deleteSaleTripCustomer.bind(null, customer.id, tripId)}><button className="text-xs text-rose-600 hover:underline">ລຶບ</button></form>
          </div>
        )}
      </Td>
    </tr>
  );
}

export function SaleProductRow({ product, tripId, canEdit, workflowStatus }: { product: SaleProductRowData; tripId: string; canEdit: boolean; workflowStatus: string }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canModify = canEdit && workflowStatus === "PLANNED";
  const remain = product.loadedQty - product.soldQty;
  const balanced = isSaleStockBalanced(product);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null);
    const result = await updateSaleTripProduct(product.id, tripId, {}, new FormData(event.currentTarget));
    setBusy(false);
    if (result.error) setError(result.error);
    else setEditing(false);
  };

  if (editing) {
    return (
      <tr>
        <Td colSpan={7}>
          <form onSubmit={submit} className="grid gap-2 md:grid-cols-5">
            <input name="productCode" required defaultValue={product.productCode} placeholder="ລະຫັດສິນຄ້າ *" className={inputClass} />
            <input name="productName" required defaultValue={product.productName} placeholder="ຊື່ສິນຄ້າ *" className={inputClass} />
            <input name="unit" defaultValue={product.unit ?? ""} placeholder="ໜ່ວຍ" className={inputClass} />
            <input name="unitPrice" type="number" min="0" required defaultValue={product.unitPrice} placeholder="ລາຄາ" className={inputClass} />
            <input name="loadedQty" type="number" min="0.001" step="0.001" required defaultValue={product.loadedQty} placeholder="ຈຳນວນຂຶ້ນລົດ" className={inputClass} />
            <div className="flex items-center gap-2 md:col-span-4">
              <Button disabled={busy}>{busy ? "..." : "ບັນທຶກ"}</Button>
              <button type="button" onClick={() => { setEditing(false); setError(null); }} className="text-xs text-muted hover:underline">ຍົກເລີກ</button>
            </div>
            {error && <p className="text-xs text-rose-600 md:col-span-5">{error}</p>}
          </form>
        </Td>
      </tr>
    );
  }

  return (
    <tr>
      <Td>
        <span className="font-medium">{product.productCode} · {product.productName}</span>
        <span className="block text-xs text-muted">{kip(product.unitPrice)}/{product.unit ?? "ໜ່ວຍ"}</span>
        {canModify && (
          <div className="mt-1 flex items-center gap-3">
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">ແກ້ໄຂ</button>
            <form action={deleteSaleTripProduct.bind(null, product.id, tripId)}><button className="text-xs text-rose-600 hover:underline">ລຶບ</button></form>
          </div>
        )}
      </Td>
      <Td className="text-right">{product.loadedQty}</Td>
      <Td className="text-right">{product.soldQty}</Td>
      <Td className="text-right">{product.sampleQty}</Td>
      <Td className="text-right">{product.returnedQty}</Td>
      <Td className="text-right">{product.damagedQty}</Td>
      <Td>
        {canEdit && workflowStatus === "RETURNED"
          ? <form action={reconcileSaleTripProduct.bind(null, product.id, tripId)} className="flex gap-1">
              <input name="sampleQty" type="number" step=".001" min="0" defaultValue={product.sampleQty} className={`${inputClass} w-16`} title="ແຈກ" />
              <input name="returnedQty" type="number" step=".001" min="0" defaultValue={Math.max(0, remain)} className={`${inputClass} w-16`} title="ຄືນ" />
              <input name="damagedQty" type="number" step=".001" min="0" defaultValue={product.damagedQty} className={`${inputClass} w-16`} title="ເສຍ" />
              <button className="text-xs text-primary">ບັນທຶກ</button>
            </form>
          : <Badge tone={balanced ? "green" : "amber"}>{balanced ? "ຄົບ" : `ເຫຼືອ ${remain}`}</Badge>}
      </Td>
    </tr>
  );
}
