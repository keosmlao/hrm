import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import {
  fuelLitreForDisplay,
  fuelReasonLabel,
  laoGpsConfigured,
  laoGpsErrorMessage,
  listFuel,
  type LaoGpsFuel,
  type LaoGpsFuelTotals,
} from "@/lib/laogps";
import { gpsVehicleOptions, num, resolveRange } from "@/lib/fleet-gps";
import { GpsFilter, GpsNotConfigured, GpsNotice } from "../gps-filter";

export const dynamic = "force-dynamic";

/** ຊ່ວງສູງສຸດຂອງ /fuel ທັງບັນຊີ — endpoint ນີ້ອ່ານ tracking store ທຸກຄັນທຸກວັນ */
const MAX_DAYS = 7;

/** GPS ບາງຄັນສົ່ງ placeholder ແທນທະບຽນ/ຊື່ລົດ. */
function usefulVehicleLabel(value: string | null | undefined) {
  const label = value?.trim();
  if (!label) return null;
  if (["ไม่ระบุ", "ບໍ່ລະບຸ", "unspecified", "unknown", "n/a", "-"].includes(label.toLowerCase())) {
    return null;
  }
  return label;
}

export default async function FleetFuelPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const { from, to, note } = resolveRange(q.from, q.to, MAX_DAYS);

  const header = (
    <PageHeader
      title="ລາຍງານນ້ຳມັນ"
      subtitle="ຍອດການໃຊ້ນ້ຳມັນທີ່ວັດ/ຄຳນວນໂດຍແພລດຟອມ GPS · ບໍ່ແມ່ນຄ່າດິບຈາກເຊັນເຊີ"
    />
  );

  if (!laoGpsConfigured()) return <>{header}<GpsNotConfigured /></>;

  let rows: LaoGpsFuel[] | null = null;
  let totals: LaoGpsFuelTotals | undefined;
  let error: string | null = null;
  try {
    const res = await listFuel({ from, to });
    rows = res.data;
    totals = res.meta.totals;
  } catch (e) {
    error = laoGpsErrorMessage(e);
  }

  // ລົດຄັນໃດຢູ່ໃນ HRM ແດ່ — ຈະໄດ້ຮູ້ວ່າອັນໃດເປັນລົດຂອງພວກເຮົາ
  const hrmVehicles = await gpsVehicleOptions();
  const hrmByImei = new Map(hrmVehicles.map((vehicle) => [vehicle.imei.trim(), vehicle]));
  const hrmImei = new Set(hrmByImei.keys());

  const multiDay = from !== to;

  return (
    <>
      {header}
      <GpsFilter action="/fleet/fuel" from={from} to={to} maxDays={MAX_DAYS} note={note} />

      {error && <GpsNotice title="ດຶງລາຍງານນ້ຳມັນບໍ່ໄດ້" detail={error} />}

      {rows && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="ນ້ຳມັນລວມ"
              value={totals?.fuel_used_litre != null ? `${num(totals.fuel_used_litre, 1)} ລິດ` : "—"}
              hint={`${from} → ${to}`}
            />
            <StatCard label="ໄລຍະທາງລວມ" value={`${num(totals?.distance_km)} ກມ`} />
            <StatCard label="ລົດທີ່ວັດນ້ຳມັນໄດ້" value={totals?.vehicles_with_fuel ?? 0} tone="good" />
            <StatCard
              label="ລົດທີ່ວັດບໍ່ໄດ້"
              value={totals?.vehicles_without_fuel ?? 0}
              tone={(totals?.vehicles_without_fuel ?? 0) > 0 ? "warn" : "default"}
              hint="ຍັງບໍ່ໄດ້ຕັ້ງຖັງ/ເຊັນເຊີ ຫຼື ອຸປະກອນ offline"
            />
          </div>

          {multiDay && (
            <p className="text-xs text-muted">
              ຊ່ວງຫຼາຍວັນ: ລົດແບບ sensor ໃຊ້ຍອດ “ລວມລາຍວັນ” ເຊິ່ງໃກ້ຄວາມຈິງກວ່າ
              ເພາະການເຕີມນ້ຳມັນນ້ອຍໆລະຫວ່າງວັນຈະບໍ່ຫາຍໄປ.
            </p>
          )}

          <Table>
            <thead>
              <tr>
                <Th className="w-16 text-center">ລຳດັບ</Th>
                <Th>ລົດ</Th>
                <Th className="text-right">ນ້ຳມັນ (ລິດ)</Th>
                <Th className="text-right">ໄລຍະທາງ</Th>
                <Th className="text-right">ກມ/ລິດ</Th>
                <Th className="text-right">ເວລາແລ່ນ</Th>
                <Th>ວິທີວັດ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={7} text="ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້" />}
              {[...rows]
                .sort((a, b) => (fuelLitreForDisplay(b) ?? -1) - (fuelLitreForDisplay(a) ?? -1))
                .map((r, index) => {
                  const litre = fuelLitreForDisplay(r);
                  const kmPerL = litre && litre > 0 ? r.distance_km / litre : null;
                  const imei = r.imei.trim();
                  const hrmVehicle = hrmByImei.get(imei);
                  const vehiclePlate = usefulVehicleLabel(hrmVehicle?.plateNo) ?? usefulVehicleLabel(r.plate);
                  const vehicleName = usefulVehicleLabel(hrmVehicle?.name) ?? usefulVehicleLabel(r.name);
                  return (
                    <tr key={r.imei}>
                      <Td className="text-center tabular text-muted">{index + 1}</Td>
                      <Td className="font-medium">
                        {vehiclePlate ?? vehicleName ?? imei}
                        {vehiclePlate && vehicleName && (
                          <span className="block text-xs font-normal text-muted">{vehicleName}</span>
                        )}
                        {!hrmImei.has(imei) && (
                          <span className="ml-2 text-xs font-normal text-muted">(ບໍ່ຢູ່ໃນ HRM)</span>
                        )}
                        {r.partial_data && (
                          <span className="ml-2 text-xs font-normal text-amber-600">ຂໍ້ມູນບໍ່ຄົບ</span>
                        )}
                      </Td>
                      <Td className="text-right tabular font-semibold">
                        {litre != null ? num(litre, 2) : <span className="font-normal text-muted">—</span>}
                      </Td>
                      <Td className="text-right tabular">{num(r.distance_km)}</Td>
                      <Td className="text-right tabular">{num(kmPerL, 1)}</Td>
                      <Td className="text-right tabular">{num(r.drive_hours)}</Td>
                      <Td className="text-xs">
                        {r.fuel_method === "sensor" && <Badge tone="blue">ເຊັນເຊີຖັງ</Badge>}
                        {r.fuel_method === "rate" && <Badge tone="violet">ອັດຕາ ກມ/ລິດ</Badge>}
                        {r.fuel_method == null && (
                          <span className="text-muted">{fuelReasonLabel(r.fuel_reason)}</span>
                        )}
                        {r.clamped && <span className="ml-2 text-amber-600">ຈຳກັດທີ່ຂະໜາດຖັງ</span>}
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}
