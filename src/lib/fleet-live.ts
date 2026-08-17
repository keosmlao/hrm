import "server-only";
import { prisma } from "./prisma";
import { laoGpsConfigured, listPositions } from "./laogps";

/**
 * ຝ່າຍລົດ HRM — ຂໍ້ມູນສົດ (raw SQL, ຕາຕະລາງ ERP/TMS ທີ່ບໍ່ຢູ່ໃນ Prisma schema).
 *
 * ຕຳແໜ່ງລົດ realtime: app_car_vehicles.gps_imei ↔ odg_tms_gps_current.imei
 * (car_code ຂອງ TMS ບໍ່ກົງກັບ app_car — ຕ້ອງ join ດ້ວຍ imei).
 */

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export type VehiclePosition = {
  id: string;
  imei: string | null;
  plateNo: string | null;
  name: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  /** ທິດທາງ 0–359° ວັດຕາມເຂັມໂມງຈາກທິດເໜືອ */
  heading: number | null;
  engineState: string | null;
  mileageKm: number | null;
  fuelPercent: number | null;
  fuelLitre: number | null;
  positionSource: "live" | "cached" | "tms";
  gpsPlate: string | null;
  gpsName: string | null;
  recordedAt: string | null;
  address: string | null;
  // trip ທີ່ກຳລັງໃຊ້ລົດຄັນນີ້ມື້ນີ້ (ຖ້າມີ)
  tripDestination: string | null;
  driverName: string | null;
};

/** ຕຳແໜ່ງລົດປັດຈຸບັນ ທຸກຄັນທີ່ມີ GPS */
export async function vehiclePositions(): Promise<VehiclePosition[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `select v.id::text id, trim(v.gps_imei) imei, v.plate_no, v.name, v.status,
            g.lat, g.lng, g.speed, g.heading, g.engine_state, g.mileage,
            g.recorded_at, g.address,
            tr.destination trip_destination, emp.fullname_lo driver_name
       from app_car_vehicles v
       left join odg_tms_gps_current g on trim(g.imei) = trim(v.gps_imei)
       left join lateral (
         select destination, driver_code
           from hrm_vehicle_trip t
          where t.vehicle_id = v.id::text
            and t.status = 'DEPARTED'
            and current_date between t.date and t.end_date
          order by t.started_at desc nulls last limit 1
       ) tr on true
       left join odg_employee emp on emp.employee_code = tr.driver_code
      where nullif(trim(v.gps_imei),'') is not null
      order by g.recorded_at desc nulls last`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    imei: (r.imei as string) ?? null,
    plateNo: (r.plate_no as string) ?? null,
    name: (r.name as string) ?? null,
    status: (r.status as string) ?? null,
    lat: n(r.lat),
    lng: n(r.lng),
    speed: n(r.speed),
    heading: n(r.heading),
    engineState: (r.engine_state as string) ?? null,
    mileageKm: n(r.mileage),
    fuelPercent: null,
    fuelLitre: null,
    positionSource: "tms",
    gpsPlate: null,
    gpsName: null,
    recordedAt: (r.recorded_at as string) ?? null,
    address: (r.address as string) ?? null,
    tripDestination: (r.trip_destination as string) ?? null,
    driverName: (r.driver_name as string) ?? null,
  }));
}

/**
 * ຕຳແໜ່ງລົດຈາກ **Lao GPS Open API** ແທນຕາຕະລາງ TMS.
 *
 * ເປັນຫຍັງ: `odg_tms_gps_current` ຂາດລົດຫຼາຍຄັນ (ວັດແທກ 2026-08-13 ຂາດ 6/27
 * ຄັນ ທັງທີ່ອຸປະກອນສົ່ງຢູ່ປົກກະຕິ) ຈຶ່ງຂຶ້ນ "ບໍ່ມີສັນຍານ" ຜິດ.
 * API ໃຫ້ຄົບ 27/27 ແລະ ເປັນ realtime.
 *
 * ຖ້າຍັງບໍ່ໄດ້ຕັ້ງ credentials ຫຼື API ລົ້ມ → ຕົກກັບໄປໃຊ້ຕາຕະລາງ TMS ຄືເກົ່າ.
 */
export async function livePositions(): Promise<VehiclePosition[]> {
  if (!laoGpsConfigured()) return vehiclePositions();

  try {
    const [api, rows] = await Promise.all([
      listPositions({ activeOnly: false }),
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `select v.id::text id, v.plate_no, v.name, v.status, trim(v.gps_imei) imei,
                tr.destination trip_destination, emp.fullname_lo driver_name
           from app_car_vehicles v
           left join lateral (
             select destination, driver_code
               from hrm_vehicle_trip t
              where t.vehicle_id = v.id::text
                and t.status = 'DEPARTED'
                and current_date between t.date and t.end_date
              order by t.started_at desc nulls last limit 1
           ) tr on true
           left join odg_employee emp on emp.employee_code = tr.driver_code
          where nullif(trim(v.gps_imei),'') is not null
          order by v.plate_no`,
      ),
    ]);

    const byImei = new Map(api.map((p) => [p.imei.trim(), p]));
    return rows.map((r) => {
      const p = byImei.get(String(r.imei));
      return {
        id: String(r.id),
        imei: String(r.imei),
        plateNo: (r.plate_no as string) ?? null,
        name: (r.name as string) ?? null,
        status: (r.status as string) ?? null,
        lat: p?.latitude ?? null,
        lng: p?.longitude ?? null,
        speed: p?.speed_kmh ?? null,
        heading: n(p?.direction),
        // ໜ້າ UI ຄາດຫວັງ "1"/"0" ແບບ TMS — ແປງໃຫ້ກົງ
        engineState: p ? (p.engine_on ? "1" : "0") : null,
        mileageKm: p?.mileage_km ?? null,
        fuelPercent: p?.fuel_percent ?? null,
        fuelLitre: p?.fuel_litre ?? null,
        positionSource: p?.source ?? "cached",
        gpsPlate: p?.plate ?? null,
        gpsName: p?.name ?? null,
        recordedAt: p?.time ?? null,
        address: p?.address ?? null,
        tripDestination: (r.trip_destination as string) ?? null,
        driverName: (r.driver_name as string) ?? null,
      };
    });
  } catch {
    // API ລົ້ມ → ຢ່າໃຫ້ໜ້າຕາຍ, ໃຊ້ຂໍ້ມູນ TMS ແທນ
    return vehiclePositions();
  }
}

export type UseSlip = {
  tripId: string;
  date: string;
  endDate: string;
  tripNo: number;
  destination: string;
  departTime: string | null;
  returnTime: string | null;
  note: string | null;
  workflowStatus: string;
  tripType: string;
  isBorrower: boolean;
  vehicleId: string | null;
  vehiclePlate: string | null;
  vehicleName: string | null;
  driverName: string | null;
  driverCode: string | null;
  borrowerName: string | null;
  borrowerCode: string | null;
  approvedAt: string | null;
  members: string[];
};

/**
 * ໃບນຳໃຊ້ລົດ ປະຈຳວັນ — trip ທີ່ອະນຸມັດແລ້ວ + ຈັດລົດແລ້ວ + ວັນທີກວມ dateISO.
 * = ຜູ້ຢືມ/ຄົນຂັບ ທີ່ໄດ້ນຳໃຊ້ລົດໃນມື້ນັ້ນ.
 */
export async function dailyUseSlips(dateISO: string): Promise<UseSlip[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `select t.id trip_id, to_char(t.date,'DD/MM/YYYY') date, to_char(t.end_date,'DD/MM/YYYY') end_date,
            t.trip_no, t.destination, t.depart_time, t.return_time, t.note,
            t.workflow_status, t.trip_type, coalesce(t.is_vehicle_borrower,false) is_borrower,
            t.vehicle_id, v.plate_no vehicle_plate, v.name vehicle_name,
            drv.fullname_lo driver_name, t.driver_code,
            req.fullname_lo borrower_name, t.requested_by_code borrower_code,
            to_char(t.approved_at,'DD/MM/YYYY HH24:MI') approved_at,
            coalesce((select array_agg(e.fullname_lo order by e.fullname_lo)
                        from hrm_trip_member m
                        join odg_employee e on e.employee_code = m.employee_code
                       where m.trip_id = t.id), '{}') members
       from hrm_vehicle_trip t
       left join app_car_vehicles v on v.id::text = t.vehicle_id
       left join odg_employee drv on drv.employee_code = t.driver_code
       left join odg_employee req on req.employee_code = t.requested_by_code
      where t.approved_at is not null
        and t.vehicle_id is not null
        and t.status <> 'CANCELLED'
        and $1::date between t.date and t.end_date
      order by v.plate_no nulls last, t.trip_no`,
    dateISO,
  );
  return rows.map((r) => ({
    tripId: String(r.trip_id),
    date: r.date as string,
    endDate: r.end_date as string,
    tripNo: Number(r.trip_no ?? 0),
    destination: (r.destination as string) ?? "",
    departTime: (r.depart_time as string) ?? null,
    returnTime: (r.return_time as string) ?? null,
    note: (r.note as string) ?? null,
    workflowStatus: (r.workflow_status as string) ?? "PLANNED",
    tripType: (r.trip_type as string) ?? "GENERAL",
    isBorrower: Boolean(r.is_borrower),
    vehicleId: r.vehicle_id == null ? null : String(r.vehicle_id),
    vehiclePlate: (r.vehicle_plate as string) ?? null,
    vehicleName: (r.vehicle_name as string) ?? null,
    driverName: (r.driver_name as string) ?? null,
    driverCode: (r.driver_code as string) ?? null,
    borrowerName: (r.borrower_name as string) ?? null,
    borrowerCode: (r.borrower_code as string) ?? null,
    approvedAt: (r.approved_at as string) ?? null,
    members: (r.members as string[]) ?? [],
  }));
}

export type MonthUse = {
  tripId: string;
  vehicleId: string;
  /** ວັນທີ່ trip ກວມ (YYYY-MM-DD) ສະເພາະທີ່ຢູ່ໃນເດືອນທີ່ຂໍ */
  days: string[];
  destination: string;
  driverName: string | null;
  departTime: string | null;
  returnTime: string | null;
};

/**
 * ການນຳໃຊ້ລົດຕະຫຼອດເດືອນ — trip ທີ່ອະນຸມັດ + ຈັດລົດແລ້ວ ທີ່ຊ້ອນກັບເດືອນນັ້ນ.
 * `monthISO` = "YYYY-MM". ຂໍເທື່ອດຽວແທນການເອີ້ນລາຍວັນ 30 ເທື່ອ.
 */
export async function monthlyUse(monthISO: string): Promise<MonthUse[]> {
  const start = `${monthISO}-01`;
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `select t.id trip_id, t.vehicle_id, t.destination, t.depart_time, t.return_time,
            to_char(greatest(t.date, $1::date), 'YYYY-MM-DD') from_day,
            to_char(least(t.end_date, ($1::date + interval '1 month - 1 day')::date), 'YYYY-MM-DD') to_day,
            drv.fullname_lo driver_name
       from hrm_vehicle_trip t
       left join odg_employee drv on drv.employee_code = t.driver_code
      where t.approved_at is not null
        and t.vehicle_id is not null
        and t.status <> 'CANCELLED'
        and t.date <= ($1::date + interval '1 month - 1 day')::date
        and t.end_date >= $1::date
      order by t.vehicle_id, t.date, t.trip_no`,
    start,
  );

  return rows.map((r) => {
    const from = r.from_day as string;
    const to = r.to_day as string;
    const days: string[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    return {
      tripId: String(r.trip_id),
      vehicleId: String(r.vehicle_id),
      days,
      destination: (r.destination as string) ?? "",
      driverName: (r.driver_name as string) ?? null,
      departTime: (r.depart_time as string) ?? null,
      returnTime: (r.return_time as string) ?? null,
    };
  });
}
