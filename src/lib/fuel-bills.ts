import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * ⛽ ບິນເຕີມນ້ຳມັນ "ຂອງຈິງ" (ຄົນບັນທຶກ) — ຕ່າງຈາກເຫດການເຕີມທີ່ GPS ຈັບໄດ້ຈາກເຊັນເຊີ
 *
 * ແຕ່ລະຝ່າຍບັນທຶກຢູ່ຄົນລະແອັບ ຈຶ່ງດຶງຄົນລະບ່ອນຕາມພະແນກຂອງລົດ:
 *   ຂົນສົ່ງ (502) + ສູນບໍລິການ/ຊ່າງ (4xx) → ແອັບຂົນສົ່ງ TMS: `odg_tms_fuel_log`
 *   ຝ່າຍຂາຍ (2xx)                        → ແອັບຂາຍ SALE: `hrm_sale_trip_expense` (type FUEL/ນ້ຳມັນ)
 *
 * ⚠ TMS ບໍ່ໄດ້ຜູກ vehicle_id — ຖັນ `car` ພິມມືເປັນປ້າຍ ຫຼື ສະເພາະເລກ ("ກບ 2608", "ກບ2608", "2608")
 *   ຈຶ່ງຈັບຄູ່ດ້ວຍປ້າຍທີ່ຕັດຊ່ອງວ່າງ/ຂີດ ແລ້ວ fallback ໄປທຽບສະເພາະຕົວເລກ (ເລກທະບຽນ 4 ໂຕບໍ່ຊ້ຳກັນ)
 */

export type FuelBillSource = "TMS" | "SALE";

export type FuelBill = {
  id: string;
  source: FuelBillSource;
  /** ISO — TMS ເປັນວັນທີເປົ່າ (ບໍ່ມີເວລາ), SALE ມີເວລາ */
  at: string;
  dateOnly: boolean;
  litre: number | null;
  amount: number | null;
  odometer: number | null;
  station: string | null;
  /** TMS = ຄົນຂັບ · SALE = trip */
  by: string | null;
  note: string | null;
  /** ລິງຮູບບິນ (ຖ້າມີ) */
  photoUrl: string | null;
};

/** ລົດພະແນກ 2xx (ຂາຍ*) ໃຊ້ບິນຈາກແອັບຂາຍ; ນອກນັ້ນ (ຂົນສົ່ງ 502, ຊ່າງ/ສູນບໍລິການ 4xx) ໃຊ້ TMS */
export function fuelBillSource(departmentCode: string | null | undefined): FuelBillSource {
  return departmentCode?.trim().startsWith("2") ? "SALE" : "TMS";
}

export const FUEL_BILL_SOURCE_LABEL: Record<FuelBillSource, string> = {
  TMS: "ແອັບຂົນສົ່ງ (TMS)",
  SALE: "ແອັບຂາຍ (SALE)",
};

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};

/** ກະແຈຈັບຄູ່ປ້າຍ: ຕົວພິມນ້ອຍ ຕັດຊ່ອງວ່າງ/ຂີດ/ຈຸດ ອອກ */
export const plateKey = (plate: string) => plate.toLowerCase().replace(/[\s\-._]+/g, "");
export const plateDigits = (plate: string) => plate.replace(/\D+/g, "");

/** ບິນນ້ຳມັນຂອງລົດຄັນໜຶ່ງ — ເລືອກແຫຼ່ງຕາມພະແນກ, ໃໝ່ສຸດກ່ອນ */
export async function vehicleFuelBills(opts: {
  vehicleId: string;
  plateNo: string;
  departmentCode: string | null;
  limit?: number;
}): Promise<FuelBill[]> {
  const limit = opts.limit ?? 100;
  return fuelBillSource(opts.departmentCode) === "SALE"
    ? saleFuelBills(opts.vehicleId, limit)
    : tmsFuelBills(opts.plateNo, limit);
}

async function tmsFuelBills(plateNo: string, limit: number): Promise<FuelBill[]> {
  const key = plateKey(plateNo);
  const digits = plateDigits(plateNo);
  if (!key) return [];
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select id::text id,
           to_char(fuel_date, 'YYYY-MM-DD') fuel_day,
           driver_name, liters, amount, odometer, station, note, fuel_type,
           (nullif(trim(coalesce(image_data, '')), '') is not null) has_photo
      from odg_tms_fuel_log
     where regexp_replace(lower(coalesce(car, '')), '[[:space:]._-]+', '', 'g') = ${key}
        or (${digits.length >= 4}
            and regexp_replace(coalesce(car, ''), '[^0-9]', '', 'g') = ${digits})
     order by fuel_date desc, id desc
     limit ${limit}`;
  return rows.map((r) => ({
    id: `tms-${String(r.id)}`,
    source: "TMS" as const,
    at: `${String(r.fuel_day)}T00:00:00+07:00`,
    dateOnly: true,
    litre: num(r.liters),
    amount: num(r.amount),
    odometer: num(r.odometer),
    station: str(r.station),
    by: str(r.driver_name),
    note: [str(r.note), str(r.fuel_type)].filter(Boolean).join(" · ") || null,
    photoUrl: r.has_photo ? `/api/fuel-photo?id=${String(r.id)}` : null,
  }));
}

async function saleFuelBills(vehicleId: string, limit: number): Promise<FuelBill[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select e.id,
           to_char(e.incurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') at_iso,
           e.litre, e.amount, e.note, e.receipt_url,
           t.trip_no, t.destination
      from hrm_sale_trip_expense e
      join hrm_vehicle_trip t on t.id = e.trip_id
     where t.vehicle_id = ${vehicleId}
       and e.type in ('FUEL', 'ນ້ຳມັນ')
     order by e.incurred_at desc
     limit ${limit}`;
  return rows.map((r) => {
    // ຮູບຈາກແອັບ SALE: token "file:…" ຕ້ອງຜ່ານ /api/photo-proxy; URL ທຳມະດາໃຊ້ຕົງ (ຫຼາຍຮູບຄັ່ນດ້ວຍ ',')
    const first = String(r.receipt_url ?? "").split(",").map((p) => p.trim()).filter(Boolean)[0] ?? null;
    return {
      id: `sale-${String(r.id)}`,
      source: "SALE" as const,
      at: String(r.at_iso),
      dateOnly: false,
      litre: num(r.litre),
      amount: num(r.amount),
      odometer: null,
      station: null,
      by: r.trip_no ? `Trip #${String(r.trip_no)} · ${String(r.destination ?? "")}`.trim() : null,
      note: str(r.note),
      photoUrl: first ? (first.startsWith("file:") ? `/api/photo-proxy?f=${encodeURIComponent(first)}` : first) : null,
    };
  });
}
