import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { kip, laoDate, laoDateTime } from "@/lib/format";
import { FUEL_BILL_SOURCE_LABEL, fuelBillSource, vehicleFuelBills } from "@/lib/fuel-bills";
import { refuelEventsBetween, vehicleTankLitres } from "@/lib/fuel-cache";
import { RefuelBadge } from "../../fuel/refuel-badge";

export const dynamic = "force-dynamic";

const DAYS = 180;
/** ຖັງໃຫຍ່ສຸດຂອງ fleet ~150 ລ — ຫຼາຍກວ່ານີ້ ແມ່ນພິມຜິດຢູ່ TMS (ໃສ່ຈຳນວນເງິນລົງຊ່ອງລິດ) → ບໍ່ເອົາເຂົ້າຍອດ */
const LITRE_MAX = 200;
const usableLitre = (litre: number | null) => (litre != null && litre > 0 && litre <= LITRE_MAX ? litre : null);

/**
 * ປະຫວັດການເຕີມນ້ຳມັນ ຕໍ່ລົດ 1 ຄັນ
 *  - ບິນຈາກແອັບຂອງຝ່າຍນັ້ນ (ຂົນສົ່ງ/ສູນບໍລິການ → TMS · ຝ່າຍຂາຍ → SALE) — ເບິ່ງ lib/fuel-bills.ts
 *  - ເຫດການເຕີມທີ່ GPS ຈັບໄດ້ (ສະເພາະລົດທີ່ມີເຊັນເຊີນ້ຳມັນ)
 */
export default async function VehicleFuelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  if (!hasRole(session, "ADMIN", "HR", "MANAGER", "EXECUTIVE")) notFound();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const vehicle = await prisma.carVehicle.findUnique({ where: { id: BigInt(id) } });
  if (!vehicle) notFound();

  const imei = vehicle.gpsImei?.trim() || null;
  const now = new Date();
  const since = new Date(now.getTime() - DAYS * 86_400_000);
  const [department, bills, gps, events, tanks] = await Promise.all([
    vehicle.departmentCode
      ? prisma.department.findUnique({ where: { code: vehicle.departmentCode }, select: { nameLo: true } })
      : null,
    vehicleFuelBills({ vehicleId: vehicle.id.toString(), plateNo: vehicle.plateNo, departmentCode: vehicle.departmentCode }),
    imei ? prisma.vehicleGpsInfo.findUnique({ where: { imei } }) : null,
    imei ? refuelEventsBetween(since, now, [imei]) : [],
    vehicleTankLitres(),
  ]);

  const source = fuelBillSource(vehicle.departmentCode);
  const tank = (imei && tanks.get(imei)) || gps?.tankLitre || null;
  const inTank = (pct: number) => (tank ? `${Math.round((pct / 100) * Number(tank))} ລ` : `${pct}%`);
  const recent = bills.filter((b) => Date.parse(b.at) >= since.getTime());
  const litre = recent.reduce((s, b) => s + (usableLitre(b.litre) ?? 0), 0);
  const amount = recent.reduce((s, b) => s + (b.amount ?? 0), 0);
  const realEvents = events.filter((e) => e.kind === "REFUEL" && e.confidence !== "REJECTED");

  return (
    <>
      <PageHeader
        title={`⛽ ປະຫວັດການເຕີມນ້ຳມັນ · ${vehicle.plateNo}`}
        subtitle={`${vehicle.name}${department?.nameLo ? ` · ${department.nameLo}` : ""} · ບິນມາຈາກ ${FUEL_BILL_SOURCE_LABEL[source]}`}
        action={<Link href="/fleet/vehicles" className="text-sm text-primary hover:underline">← ກັບລາຍການລົດ</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`ບິນເຕີມ (${DAYS} ວັນ)`} value={`${recent.length} ຄັ້ງ`} />
        <StatCard label="ລິດລວມ" value={litre ? `${litre.toLocaleString(undefined, { maximumFractionDigits: 2 })} ລ` : "—"} />
        <StatCard label="ເງິນລວມ" value={amount ? kip(amount) : "—"} />
        <StatCard label="GPS ຈັບການເຕີມ" value={imei ? `${realEvents.length} ຄັ້ງ` : "ບໍ່ມີ GPS"} tone={imei ? undefined : "warn"} />
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">
          ບິນເຕີມນ້ຳມັນ ({bills.length}) <Badge tone={source === "SALE" ? "violet" : "blue"}>{FUEL_BILL_SOURCE_LABEL[source]}</Badge>
        </h2>
        <p className="mb-4 text-xs text-muted">
          {source === "TMS"
            ? "ຄົນຂັບບັນທຶກຢູ່ແອັບຂົນສົ່ງ (odg_tms_fuel_log) — ຈັບຄູ່ດ້ວຍເລກທະບຽນ"
            : "ພະນັກງານຂາຍບັນທຶກເປັນຄ່າໃຊ້ຈ່າຍ Trip ຢູ່ແອັບຂາຍ (type ນ້ຳມັນ)"}
        </p>
        <Table>
          <thead>
            <tr>
              <Th>ວັນທີ</Th>
              <Th>{source === "TMS" ? "ຄົນຂັບ" : "Trip"}</Th>
              <Th className="text-right">ລິດ</Th>
              <Th className="text-right">ເງິນ</Th>
              <Th className="text-right">ໄມລ໌</Th>
              <Th>ປ້ຳ</Th>
              <Th>ໝາຍເຫດ</Th>
              <Th>ບິນ</Th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && (
              <EmptyRow
                colSpan={8}
                text={source === "TMS"
                  ? "ຍັງບໍ່ພົບບິນຂອງລົດຄັນນີ້ໃນແອັບຂົນສົ່ງ"
                  : "ຍັງບໍ່ພົບບິນນ້ຳມັນຂອງລົດຄັນນີ້ໃນແອັບຂາຍ"}
              />
            )}
            {bills.map((b) => (
              <tr key={b.id}>
                <Td className="whitespace-nowrap">{b.dateOnly ? laoDate(b.at) : laoDateTime(b.at)}</Td>
                <Td className="text-xs">{b.by ?? "-"}</Td>
                <Td className="text-right tabular">
                  {b.litre == null
                    ? "-"
                    : usableLitre(b.litre) != null
                      ? b.litre.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : <span className="text-amber-600" title="ຄ່າຜິດປົກກະຕິ — ໜ້າຈະພິມຈຳນວນເງິນລົງຊ່ອງລິດ ຢູ່ແອັບຕົ້ນທາງ">⚠ {b.litre.toLocaleString()}</span>}
                </Td>
                <Td className="text-right tabular">{b.amount != null ? kip(b.amount) : "-"}</Td>
                <Td className="text-right tabular">{b.odometer != null ? b.odometer.toLocaleString() : "-"}</Td>
                <Td className="text-xs">{b.station ?? "-"}</Td>
                <Td className="max-w-[240px] truncate text-xs" title={b.note ?? ""}>{b.note ?? "-"}</Td>
                <Td className="text-xs">
                  {b.photoUrl
                    ? <a href={b.photoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">🧾 ຮູບ</a>
                    : <span className="text-muted">-</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">ເຫດການເຕີມທີ່ GPS ຈັບໄດ້ ({events.length})</h2>
        <p className="mb-4 text-xs text-muted">
          {!imei
            ? "ລົດຄັນນີ້ຍັງບໍ່ໄດ້ຜູກ GPS"
            : `ຈາກເຊັນເຊີນ້ຳມັນ ${DAYS} ວັນຫຼ້າສຸດ — ຄິດລິດຈາກ % ຖັງທີ່ເພີ່ມຂຶ້ນຂະນະຈອດ${gps?.fuelMethod === "rate" ? " · Lao GPS ຕິດປ້າຍຄັນນີ້ວ່າ “rate” ແຕ່ຈຸດ GPS ມີ % ນ້ຳມັນ ຈຶ່ງຍັງຈັບການເຕີມໄດ້" : ""}`}
        </p>
        {imei && (
          <Table>
            <thead>
              <tr>
                <Th>ເວລາ</Th>
                <Th className="text-right">ໃນຖັງ ກ່ອນ → ຫຼັງ</Th>
                <Th className="text-right">ປ່ຽນແປງ (ລິດ)</Th>
                <Th>ຈຸດຈອດ</Th>
                <Th>ສະຖານະ</Th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && <EmptyRow colSpan={5} text="ຍັງບໍ່ພົບເຫດການເຕີມ" />}
              {events.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{laoDateTime(new Date(e.time))}</Td>
                  <Td className="text-right tabular">
                    {inTank(e.beforePercent)} → {inTank(e.afterPercent)}
                    <span className="block text-[10px] text-muted">{e.beforePercent}% → {e.afterPercent}%{tank ? ` · ຖັງ ${Math.round(Number(tank))} ລ` : ""}</span>
                  </Td>
                  <Td className={`text-right tabular font-semibold ${e.kind === "DROP" ? "text-rose-700" : "text-emerald-700"}`}>
                    {e.kind === "DROP" ? "−" : "+"}{e.litre} ລ
                  </Td>
                  <Td className="max-w-[260px] truncate text-xs" title={e.address ?? ""}>{e.address ?? "-"}</Td>
                  <Td><RefuelBadge e={e} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
