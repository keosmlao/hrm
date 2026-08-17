import { inputClass } from "@/components/ui";
import type { GpsVehicleOption } from "@/lib/fleet-gps";
import { vehicleLabel } from "@/lib/fleet-gps";

/**
 * ແຖບເລືອກຊ່ວງວັນທີ (+ ລົດ) ຂອງລາຍງານ GPS — form GET ທຳມະດາ,
 * ຄ່າຢູ່ໃນ URL ຈຶ່ງ bookmark/share ໄດ້.
 */
export function GpsFilter({
  action,
  from,
  to,
  maxDays,
  vehicles,
  selectedImei,
  note,
}: {
  action: string;
  from: string;
  to: string;
  maxDays: number;
  /** ບໍ່ໃສ່ = ລາຍງານທັງກອງ (ບໍ່ມີຕົວເລືອກລົດ) */
  vehicles?: GpsVehicleOption[];
  selectedImei?: string;
  note?: string | null;
}) {
  return (
    <form action={action} method="get" className="mb-5 space-y-2">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        {vehicles && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ລົດ</span>
            <select name="imei" defaultValue={selectedImei} className={`${inputClass} min-w-56`}>
              {vehicles.map((v) => (
                <option key={v.imei} value={v.imei}>
                  {vehicleLabel(v)}
                  {v.plateNo && v.name ? ` · ${v.name}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ແຕ່ວັນທີ</span>
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ຫາວັນທີ</span>
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55]"
        >
          ສະແດງລາຍງານ
        </button>
        <span className="ml-auto text-xs text-muted">ຊ່ວງສູງສຸດ {maxDays} ວັນ</span>
      </div>
      {note && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{note}</p>
      )}
    </form>
  );
}

/** ກ່ອງແຈ້ງເຕືອນເມື່ອເອີ້ນ API ບໍ່ໄດ້ */
export function GpsNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-5">
      <p className="font-semibold text-rose-800">{title}</p>
      {detail && <p className="mt-1 text-sm text-rose-700">{detail}</p>}
    </div>
  );
}

/** ຂໍ້ຄວາມເມື່ອຍັງບໍ່ໄດ້ຕັ້ງ credentials ໃນ .env */
export function GpsNotConfigured() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">ຍັງບໍ່ໄດ້ຕັ້ງບັນຊີ LaoGPS</p>
      <p className="mt-1">
        ໃສ່ຄ່າຂ້າງລຸ່ມນີ້ໃນໄຟລ໌ <code className="rounded bg-amber-100 px-1">.env</code> ແລ້ວ restart ເຊີເວີ:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-md bg-amber-100 p-3 text-xs">
        {`GPS_OPENAPI_USER=ຊື່ຜູ້ໃຊ້ gps.laogpstracker.com\nGPS_OPENAPI_PASS=ລະຫັດຜ່ານ`}
      </pre>
      <p className="mt-2">
        ⚠️ ບໍ່ແມ່ນບັນຊີ <code className="rounded bg-amber-100 px-1">GPS_TRACKER_*</code>{" "}
        (apis.thaigpstracker.co.th) — Lao GPS ປະຕິເສດບັນຊີນັ້ນ
      </p>
    </div>
  );
}
