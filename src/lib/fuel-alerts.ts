import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * 🔔 ແຈ້ງເຕືອນນ້ຳມັນ — ອ່ານຈາກເຫດການທີ່ cron `gps:sync-fuel` ຂຽນໄວ້ (ບໍ່ເອີ້ນ GPS ຕອນເປີດໜ້າ)
 * ເອົາສະເພາະອັນທີ່ **ຍັງບໍ່ມີຄົນຕັດສິນ** (confirm_status is null) — ກົດຕັດສິນຢູ່ /fleet/fuel/review ແລ້ວຫາຍໄປ
 */

export type FuelAlert = {
  id: string;
  vehicleId: string | null;
  plate: string;
  /** ISO (UTC) */
  at: string;
  litre: number;
  beforePct: number;
  afterPct: number;
  stopMinutes: number | null;
  address: string | null;
};

/** ນ້ຳມັນຫຼຸດຂະນະຈອດ ທີ່ຍັງລໍກວດ — ໃໝ່ສຸດກ່ອນ */
export async function fuelDropAlerts(days = 14, limit = 10): Promise<FuelAlert[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select e.id::text id, v.id::text vehicle_id,
           coalesce(nullif(trim(v.plate_no), ''), e.imei) plate,
           to_char(e.event_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') at_iso,
           e.litre, e.before_pct, e.after_pct, e.stop_minutes, e.address
      from hrm_vehicle_refuel_event e
      left join public.app_car_vehicles v on trim(v.gps_imei) = e.imei
     where e.kind = 'DROP'
       and e.confirm_status is null
       and e.event_time > now() - (${days}::int * interval '1 day')
     order by e.event_time desc
     limit ${limit}`;
  return rows.map((r) => ({
    id: String(r.id),
    vehicleId: r.vehicle_id == null ? null : String(r.vehicle_id),
    plate: String(r.plate),
    at: String(r.at_iso),
    litre: Number(r.litre ?? 0),
    beforePct: Number(r.before_pct ?? 0),
    afterPct: Number(r.after_pct ?? 0),
    stopMinutes: r.stop_minutes == null ? null : Number(r.stop_minutes),
    address: (r.address as string | null) ?? null,
  }));
}

/** ຈຳນວນລາຍການໃນແຕ່ລະຄິວຂອງໜ້າກວດ */
export async function fuelReviewCounts(days = 45): Promise<{ drops: number; lowConfidence: number; noReceipt: number }> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    select count(*) filter (where kind = 'DROP')::int drops,
           count(*) filter (where kind = 'REFUEL' and confidence = 'CHECK')::int low_confidence,
           count(*) filter (where kind = 'REFUEL' and confidence <> 'CHECK'
                              and coalesce((checks->>'receipt')::boolean, false) = false)::int no_receipt
      from hrm_vehicle_refuel_event
     where confirm_status is null
       and event_time > now() - (${days}::int * interval '1 day')`;
  const r = rows[0] ?? {};
  return {
    drops: Number(r.drops ?? 0),
    lowConfidence: Number(r.low_confidence ?? 0),
    noReceipt: Number(r.no_receipt ?? 0),
  };
}
