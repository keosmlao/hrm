import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import {
  getHistory,
  fuelReasonLabel,
  laoGpsConfigured,
  laoGpsErrorMessage,
  type LaoGpsHistory,
  type LaoGpsHistoryMeta,
  type WithMeta,
} from "@/lib/laogps";
import {
  detectStops,
  gpsVehicleOptions,
  hours,
  laoTime,
  minutesLabel,
  num,
  resolveRange,
  vehicleLabel,
} from "@/lib/fleet-gps";
import { GpsFilter, GpsNotConfigured, GpsNotice } from "../gps-filter";
import { TrackPlayer } from "./track-player";

export const dynamic = "force-dynamic";

/** ຊ່ວງສູງສຸດຂອງ /vehicles/{id}/history */
const MAX_DAYS = 31;
/** ຈອດດົນເທົ່າໃດຈຶ່ງນັບເປັນ "ຈຸດຈອດ" (ນາທີ) */
const MIN_STOP_MIN = 5;

export default async function GpsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ imei?: string; from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const { from, to, note } = resolveRange(q.from, q.to, MAX_DAYS);
  const vehicles = await gpsVehicleOptions();
  const selected = vehicles.find((v) => v.imei === q.imei) ?? vehicles[0];

  const header = (
    <PageHeader
      title="ປະຫວັດເສັ້ນທາງ"
      subtitle="ເສັ້ນທາງລົດຍ້ອນຫຼັງຈາກ Lao GPS Open API · ໃຊ້ກວດວ່າ trip ນັ້ນແລ່ນໄປໃສແທ້"
    />
  );

  if (!laoGpsConfigured()) return <>{header}<GpsNotConfigured /></>;
  if (!selected) {
    return (
      <>
        {header}
        <GpsNotice
          title="ຍັງບໍ່ມີລົດທີ່ຕັ້ງ GPS IMEI"
          detail="ຕັ້ງ IMEI ຂອງອຸປະກອນ GPS ໃຫ້ລົດໃນລະບົບ ERP ກ່ອນ ຈຶ່ງດຶງປະຫວັດໄດ້"
        />
      </>
    );
  }

  let result: WithMeta<LaoGpsHistory, LaoGpsHistoryMeta> | null = null;
  let error: string | null = null;
  try {
    result = await getHistory(selected.imei, { from, to, includePoints: true });
  } catch (e) {
    error = laoGpsErrorMessage(e);
  }

  return (
    <>
      {header}
      <GpsFilter
        action="/fleet/history"
        from={from}
        to={to}
        maxDays={MAX_DAYS}
        vehicles={vehicles}
        selectedImei={selected.imei}
        note={note}
      />

      {error && <GpsNotice title={`ດຶງປະຫວັດ ${vehicleLabel(selected)} ບໍ່ໄດ້`} detail={error} />}

      {result && <HistoryResult result={result} />}
    </>
  );
}

function HistoryResult({ result }: { result: WithMeta<LaoGpsHistory, LaoGpsHistoryMeta> }) {
  const { data, meta } = result;
  const s = data.summary;
  const f = data.fuel;

  // ເສັ້ນທາງເທິງແຜນທີ່ໃຊ້ຈຸດເຕັມ — ຄັດຈຸດທີ່ບໍ່ມີ fix ອອກ
  const track = data.points
    .filter((p) => p.latitude != null && p.longitude != null && (p.latitude !== 0 || p.longitude !== 0))
    .map((p) => ({ lat: p.latitude!, lng: p.longitude! }));

  const stops = detectStops(data.points, { minMinutes: MIN_STOP_MIN });

  // ຈຸດສຳລັບ replay — ຕ້ອງມີເວລາທີ່ parse ໄດ້ ແລະ ຮຽງຂຶ້ນຕາມເວລາ
  const play = data.points
    .filter((p) => p.latitude != null && p.longitude != null && (p.latitude !== 0 || p.longitude !== 0))
    .map((p) => ({ lat: p.latitude!, lng: p.longitude!, t: Date.parse(p.time), speed: p.speed_kmh }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ໄລຍະທາງ" value={`${num(s.distance_km)} ກມ`} hint={`${s.trips} ຖ້ຽວ`} />
        <StatCard label="ເວລາແລ່ນ" value={hours(s.drive_hours)} hint={`ຈອດຕິດເຄື່ອງ ${hours(s.idle_hours)}`} />
        <StatCard
          label="ຄວາມໄວສູງສຸດ"
          value={`${num(s.max_speed_kmh, 0)} ກມ/ຊມ`}
          hint={`ເກີນກຳນົດ ${s.overspeed_count} ຄັ້ງ`}
          tone={s.overspeed_count > 0 ? "warn" : "good"}
        />
        <StatCard
          label="ນ້ຳມັນທີ່ໃຊ້"
          value={f.used_litre != null ? `${num(f.used_litre, 2)} ລິດ` : "—"}
          hint={
            f.used_litre != null
              ? `ວິທີ ${f.method ?? "-"} · ${f.sample_count} ຄ່າ${f.clamped ? " · ຖືກຈຳກັດທີ່ຂະໜາດຖັງ" : ""}`
              : fuelReasonLabel(f.reason)
          }
        />
      </div>

      {track.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">
            ແຜນທີ່ເສັ້ນທາງ
            <span className="ml-2 text-xs font-normal text-muted">
              {num(track.length, 0)} ຈຸດ · 🟢 ເລີ່ມ · 🔴 ຈົບ · 🟠 ຈຸດຈອດ {stops.length} ບ່ອນ · 🔵 ລົດ (ກົດ ▶ ເພື່ອເບິ່ງການເຄື່ອນໄຫວ)
            </span>
          </h2>
          <TrackPlayer points={play} stops={stops} />
        </div>
      )}

      {stops.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">
            ຈຸດຈອດ ({stops.length} ບ່ອນ)
            <span className="ml-2 text-xs font-normal text-muted">
              ລວມເວລາຈອດ {minutesLabel(stops.reduce((n, s) => n + s.minutes, 0))}
            </span>
          </h2>
          <Table>
            <thead>
              <tr>
                <Th className="w-10">#</Th>
                <Th>ເວລາຈອດ</Th>
                <Th className="text-right">ດົນເທົ່າໃດ</Th>
                <Th>ຕຳແໜ່ງ</Th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s) => (
                <tr key={s.seq}>
                  <Td className="tabular font-bold text-amber-600">{s.seq}</Td>
                  <Td className="tabular whitespace-nowrap text-sm">
                    {laoTime(s.from)} – {laoTime(s.to).slice(-5)}
                  </Td>
                  <Td className="text-right font-medium whitespace-nowrap">{minutesLabel(s.minutes)}</Td>
                  <Td className="text-xs text-muted">
                    <a
                      href={`https://maps.google.com/?q=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-600 hover:underline"
                    >
                      {s.address ?? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted">
        ຍອດນ້ຳມັນຂ້າງເທິງແມ່ນຄ່າທີ່ຖືກຕ້ອງຈາກແພລດຟອມ (ຜ່ານການຄັດການເຕີມນ້ຳມັນ ແລະ
        ສັນຍານແກວ່ງອອກແລ້ວ) — ບໍ່ແມ່ນຜົນບວກຂອງຄ່າ % ດິບຈາກເຊັນເຊີ.
      </p>

      {meta.truncated && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ຈຸດເກີນ {num(meta.max_points, 0)} — ສະແດງພຽງ {num(meta.points_returned, 0)} ຈາກ{" "}
          {num(meta.points_total, 0)} ຈຸດ. ຕົວເລກສະຫຼຸບ ແລະ ນ້ຳມັນຂ້າງເທິງຍັງຄຸມຊ່ວງເຕັມ.
          ຢາກເບິ່ງຕໍ່ ໃຫ້ຕັ້ງວັນເລີ່ມເປັນ {laoTime(meta.next_from)}.
        </p>
      )}

    </div>
  );
}
