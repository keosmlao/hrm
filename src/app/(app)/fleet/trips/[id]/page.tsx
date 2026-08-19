import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, StatCard, Table, Td, Th, inputClass } from "@/components/ui";
import { kip, laoDate, laoDateTime } from "@/lib/format";
import { EnableSaleTripForm, SaleExpenseForm, SaleOrderForm } from "../../sale-forms";
import { TripEditActions } from "../../trip-edit-actions";
import { advanceSaleTrip } from "../../sale-actions";
import { isSaleStockBalanced } from "@/lib/sale-trip";
import { tripScheduleLabel } from "@/lib/trip";
import { laoNaiveToUtc } from "@/lib/fuel-events";
import { tripFuelFromCache, type TripFuelReport } from "@/lib/fuel-cache";
import TripFuelCard from "./trip-fuel";

export const dynamic = "force-dynamic";

export default async function SaleTripPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  if (!hasRole(session, "ADMIN", "HR", "MANAGER", "EXECUTIVE")) notFound();
  const { id } = await params;
  const trip = await prisma.vehicleTrip.findUnique({
    where: { id },
    include: { driver: { select: { fullnameLo: true } }, members: { include: { employee: { select: { fullnameLo: true } } } }, saleCustomers: { orderBy: { sequence: "asc" } }, saleProducts: { orderBy: { productCode: "asc" } }, saleOrders: { include: { items: true }, orderBy: { soldAt: "desc" } }, salePayments: { orderBy: { receivedAt: "desc" } }, saleExpenses: { orderBy: { incurredAt: "desc" } } },
  });
  if (!trip) notFound();
  const canEdit = hasRole(session, "ADMIN", "HR", "MANAGER");
  const vehicle = trip.vehicleId && /^\d+$/.test(trip.vehicleId) ? await prisma.carVehicle.findUnique({ where: { id: BigInt(trip.vehicleId) } }) : null;
  const [editVehicles, editEmployees] = canEdit
    ? await Promise.all([
        prisma.carVehicle.findMany({ where: { status: { not: "retired" } }, select: { id: true, plateNo: true, name: true }, orderBy: { plateNo: "asc" } }),
        prisma.employee.findMany({ where: { employmentStatus: "ACTIVE" }, select: { code: true, fullnameLo: true }, orderBy: { code: "asc" } }),
      ])
    : [[], []];
  const tripEditable = trip.workflowStatus !== "CLOSED" && trip.status !== "CANCELLED";
  const sales = trip.saleOrders.reduce((sum, row) => sum + Number(row.total), 0);
  const paid = trip.salePayments.reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = trip.saleExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const target = Number(trip.salesTarget);
  // ⛽ ນ້ຳມັນ GPS ຂອງ trip — ສະເພາະ SALE trip ທີ່ອອກແລ້ວ ແລະ ລົດມີ IMEI (ຊ່ວງ started_at..returned_at/ຕອນນີ້)
  let fuel: TripFuelReport | null = null;
  const imei = vehicle?.gpsImei?.trim();
  if (trip.tripType === "SALE" && imei && trip.workflowStatus !== "PLANNED" && trip.status !== "CANCELLED") {
    const from = laoNaiveToUtc(trip.startedAt ?? trip.date);
    const to = laoNaiveToUtc(trip.returnedAt ?? new Date(trip.endDate.getTime() + 86_400_000));
    // ຈາກ cache ໃນ DB (cron gps:sync-fuel) — ບໍ່ເອີ້ນ Lao GPS ຕອນເປີດໜ້າ (ຊ້າ 30–200 ວິ)
    fuel = to > from ? await tripFuelFromCache(imei, from, to).catch(() => null) : null;
  }
  // 🏪 ຮ້ານທີ່ວາງແຜນ/ເຂົ້າພົບ ຈາກ Sales Call (SALE): app_route_plan.trip_id + app_customer_visit.trip_id — ດຶງມາສະແດງແທນຕາຕະລາງ "ແຜນລູກຄ້າ" ແບບເກົ່າ
  type ScShop = { id: string; d: string; tm: string | null; code: string; name: string; phone: string | null; address: string | null; employee: string; status: string; approved: boolean; visited_at: string | null; checked_out_at: string | null; result: string | null; order_amount: number | null };
  const scShops = trip.tripType === "SALE"
    ? await prisma.$queryRaw<ScShop[]>`
        select p.id::text id, to_char(p.planned_date,'DD/MM') d, to_char(p.scheduled_time,'HH24:MI') tm,
               p.customer_code code, coalesce(nullif(trim(c.name_1),''), p.customer_code) "name",
               nullif(trim(c.telephone),'') phone,
               nullif(trim(c.address),'') address,
               coalesce(nullif(trim(e.fullname_lo),''), p.employee_code) employee,
               p.status, (p.approved_at is not null) approved,
               to_char(v.visited_at,'DD/MM HH24:MI') visited_at, to_char(v.checked_out_at,'HH24:MI') checked_out_at,
               v.result, v.order_amount::float order_amount
          from public.app_route_plan p
          left join public.ar_customer c on c.code = p.customer_code
          left join public.odg_employee e on e.employee_code = p.employee_code
          left join public.app_customer_visit v on v.id = p.visit_id
         where p.trip_id = ${trip.id}
         order by p.planned_date, p.scheduled_time nulls last, p.id`.catch(() => [] as ScShop[])
    : [];
  // ບິນນ້ຳມັນ — HRM ບັນທຶກ type "FUEL", ແອັບ/ເວັບ SALE ບັນທຶກ "ນ້ຳມັນ"
  const fuelBills = trip.saleExpenses.filter((e) => e.type === "FUEL" || e.type === "ນ້ຳມັນ");
  const stockBalanced = trip.saleProducts.length > 0 && trip.saleProducts.every((p) => isSaleStockBalanced({ loadedQty: Number(p.loadedQty), soldQty: Number(p.soldQty), sampleQty: Number(p.sampleQty), returnedQty: Number(p.returnedQty), damagedQty: Number(p.damagedQty) }));

  return <>
    <PageHeader title={`Trip #${trip.tripNo} · ${trip.destination}`} subtitle={`${tripScheduleLabel(trip.date, trip.endDate, trip.departTime, trip.returnTime, laoDate)} · ${vehicle?.plateNo ?? "ຍັງບໍ່ມີລົດ"} · ${trip.driver?.fullnameLo ?? "ຍັງບໍ່ມີຄົນຂັບ"}`} action={<div className="flex items-center gap-4">
      {canEdit && <TripEditActions tripId={trip.id} editable={tripEditable} vehicles={editVehicles.map((v) => ({ value: v.id.toString(), label: `${v.plateNo} · ${v.name}` }))} employees={editEmployees.map((e) => ({ value: e.code, label: `${e.code} · ${e.fullnameLo}` }))} defaults={{ destination: trip.destination, date: trip.date.toISOString().slice(0, 10), endDate: trip.endDate.toISOString().slice(0, 10), departTime: trip.departTime ?? "", returnTime: trip.returnTime ?? "", vehicleId: trip.vehicleId ?? "", driverCode: trip.driverCode ?? "", note: trip.note ?? "" }} />}
      <Link href={`/fleet/trips?date=${trip.date.toISOString().slice(0,10)}`} className="text-sm text-primary hover:underline">← ກັບລາຍການ</Link>
    </div>} />

    {trip.tripType !== "SALE" ? <Card><h2 className="mb-3 font-semibold">Trip ນີ້ຍັງເປັນ Trip ທົ່ວໄປ</h2>{canEdit ? <EnableSaleTripForm tripId={trip.id} /> : <p className="text-sm text-muted">ຕ້ອງໃຫ້ HR/Manager ເປີດ Sale Trip</p>}</Card> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="ເປົ້າໝາຍ" value={kip(target)} /><StatCard label="ຍອດຂາຍ" value={kip(sales)} tone={sales >= target && target > 0 ? "good" : undefined} /><StatCard label="ຮັບເງິນ" value={kip(paid)} /><StatCard label="ຄ້າງຮັບ" value={kip(Math.max(0, sales - paid))} tone={sales > paid ? "warn" : "good"} /><StatCard label="ຄ່າໃຊ້ຈ່າຍ" value={kip(expenses)} /></div>

      <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Workflow</h2><p className="text-xs text-muted">{trip.workflowStatus} · ໄມລ໌ {trip.openingOdometer ?? "—"} → {trip.closingOdometer ?? "—"}</p></div><Badge tone={trip.workflowStatus === "CLOSED" ? "green" : trip.workflowStatus === "RETURNED" ? "blue" : "amber"}>{trip.workflowStatus}</Badge></div>{canEdit && trip.workflowStatus !== "CLOSED" && <div className="mt-4 flex flex-wrap gap-3">{trip.workflowStatus === "PLANNED" && <StageForm action={advanceSaleTrip.bind(null, trip.id, "DEPARTED")} label="ອອກ Trip" />}{["DEPARTED", "IN_PROGRESS"].includes(trip.workflowStatus) && <StageForm action={advanceSaleTrip.bind(null, trip.id, "RETURNED")} label="ກັບຮອດແລ້ວ" />}{trip.workflowStatus === "RETURNED" && <form action={advanceSaleTrip.bind(null, trip.id, "CLOSED")} className="flex items-end gap-2"><input type="hidden" name="odometer" value={trip.closingOdometer ?? 0} /><button disabled={!stockBalanced} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">ປິດ Trip</button>{!stockBalanced && <span className="text-xs text-rose-600">ຕ້ອງກວດສິນຄ້າໃຫ້ຄົບກ່ອນ</span>}</form>}</div>}
        {(trip.departurePhotoUrl || trip.returnPhotoUrl || trip.openingOdometer != null || trip.closingOdometer != null) && <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <HandoverPhoto label="ຮັບລົດ (ກ່ອນອອກ)" url={trip.departurePhotoUrl} mile={trip.openingOdometer} />
          <HandoverPhoto label="ສົ່ງລົດ (ຕອນກັບ)" url={trip.returnPhotoUrl} mile={trip.closingOdometer} />
        </div>}</Card>

      {fuel && <TripFuelCard fuel={fuel} plate={vehicle?.plateNo ?? imei ?? ""} fuelBills={fuelBills.length} billTotal={fuelBills.reduce((s, e) => s + Number(e.amount), 0)} />}

      <Card>
        <h2 className="mb-1 font-semibold">🏪 ຮ້ານທີ່ວາງແຜນ / ເຂົ້າພົບ ({scShops.length}) <Badge tone="blue">Sales Call</Badge></h2>
        <p className="mb-4 text-xs text-muted">ດຶງຈາກແຜນ Sales Call ຂອງຜູ້ຂໍ ແລະ ຜູ້ຮ່ວມເດີນທາງ (ແອັບ/ເວັບ SALE) — check-in ຮ້ານ, ຜົນ, Order ອັບເດດເອງ · ພົບແລ້ວ {scShops.filter((x) => x.visited_at).length} · Order ລວມ {Math.round(scShops.reduce((s0, x) => s0 + (x.order_amount ?? 0), 0)).toLocaleString()} ບາດ</p>
        <Table>
          <thead><tr><Th>ວັນ/ເວລາ</Th><Th>ລູກຄ້າ</Th><Th>ເບີໂທ</Th><Th>ທີ່ຢູ່</Th><Th>ພະນັກງານ</Th><Th>Check-in</Th><Th>ຜົນ</Th><Th className="text-right">Order (ບາດ)</Th></tr></thead>
          <tbody>
            {scShops.length === 0 && <EmptyRow colSpan={8} text="ຍັງບໍ່ມີແຜນ Sales Call ຜູກກັບ trip ນີ້" />}
            {scShops.map((x) => (
              <tr key={x.id}>
                <Td className="whitespace-nowrap">{x.d}{x.tm ? ` ${x.tm}` : ""}</Td>
                <Td className="font-medium">{x.name}<span className="block text-xs font-normal text-muted">{x.code}</span></Td>
                <Td>{x.phone ?? "-"}</Td>
                <Td className="max-w-[260px] truncate" title={x.address ?? ""}>{x.address ?? "-"}</Td>
                <Td>{x.employee}</Td>
                <Td>{x.visited_at ? <span className="text-emerald-700">✓ {x.visited_at}{x.checked_out_at ? `–${x.checked_out_at}` : ""}</span> : x.status === "skipped" ? <Badge tone="gray">ຂ້າມ</Badge> : x.approved ? <Badge tone="amber">ລໍເຂົ້າພົບ</Badge> : <Badge tone="gray">ລໍອະນຸມັດ</Badge>}</Td>
                <Td>{x.result ?? "-"}</Td>
                <Td className="text-right tabular">{x.order_amount ? Math.round(x.order_amount).toLocaleString() : "-"}</Td>
              </tr>
            ))}
            </tbody>
          </Table>
      </Card>

      <Card><h2 className="mb-4 font-semibold">ການຂາຍ ({trip.saleOrders.length})</h2>{canEdit && ["DEPARTED", "IN_PROGRESS"].includes(trip.workflowStatus) && trip.saleProducts.length > 0 && <div className="mb-5"><SaleOrderForm tripId={trip.id} customers={trip.saleCustomers.map((c) => ({ id: c.id, label: c.customerName }))} products={trip.saleProducts.map((p) => ({ id: p.id, label: `${p.productCode} · ${p.productName}`, unitPrice: Number(p.unitPrice) }))} /></div>}<Table><thead><tr><Th>ເລກທີ</Th><Th>ລູກຄ້າ</Th><Th>ລາຍການ</Th><Th className="text-right">ລວມ</Th><Th className="text-right">ຈ່າຍ</Th><Th>ເວລາ</Th></tr></thead><tbody>{trip.saleOrders.length === 0 && <EmptyRow colSpan={6} text="ຍັງບໍ່ມີການຂາຍ" />}{trip.saleOrders.map((o) => <tr key={o.id}><Td>{o.orderNo}</Td><Td>{o.customerName}</Td><Td className="text-xs">{o.items.map((i) => `${i.productName} × ${Number(i.quantity)}`).join(", ")}</Td><Td className="text-right">{kip(Number(o.total))}</Td><Td className="text-right">{kip(Number(o.paidAmount))}</Td><Td>{laoDateTime(o.soldAt)}</Td></tr>)}</tbody></Table></Card>

      <Card><h2 className="mb-4 font-semibold">ຄ່າໃຊ້ຈ່າຍ ({trip.saleExpenses.length})</h2>{canEdit && trip.workflowStatus !== "CLOSED" && <div className="mb-5"><SaleExpenseForm tripId={trip.id} /></div>}<Table><thead><tr><Th>ປະເພດ</Th><Th>ໝາຍເຫດ</Th><Th className="text-right">ຈຳນວນ</Th><Th>ເວລາ</Th><Th>ບິນ / ຮູບ</Th></tr></thead><tbody>{trip.saleExpenses.length === 0 && <EmptyRow colSpan={5} text="ຍັງບໍ່ມີຄ່າໃຊ້ຈ່າຍ" />}{trip.saleExpenses.map((e) => {
        // ຮູບຈາກແອັບ SALE: token "file:…" (ຄັ່ນ ',' ຖ້າຫຼາຍຮູບ) → ຜ່ານ /api/photo-proxy; URL ທຳມະດາ → ລິງຕົງ
        const photos = (e.receiptUrl ?? "").split(",").map((p) => p.trim()).filter(Boolean);
        return <tr key={e.id}><Td>{e.type === "ນ້ຳມັນ" || e.type === "FUEL" ? "⛽ " : ""}{e.type}</Td><Td>{e.note ?? "-"}</Td><Td className="text-right">{kip(Number(e.amount))}</Td><Td>{laoDateTime(e.incurredAt)}</Td><Td className="text-xs">{photos.length === 0 ? <span className="text-muted">-</span> : photos.map((p, i) => <a key={p} href={p.startsWith("file:") ? `/api/photo-proxy?f=${encodeURIComponent(p)}` : p} target="_blank" rel="noreferrer" className="mr-2 text-primary hover:underline">🧾 ຮູບ {i + 1}</a>)}</Td></tr>;
      })}</tbody></Table></Card>
    </>}
  </>;
}

function StageForm({ action, label }: { action: (fd: FormData) => void | Promise<void>; label: string }) { return <form action={action} className="flex flex-wrap items-end gap-2"><label className="text-xs text-muted">ເລກໄມລ໌<input name="odometer" type="number" min="0" required className={`${inputClass} mt-1 w-32`} /></label><label className="text-xs text-muted">ນ້ຳມັນ %<input name="fuel" type="number" min="0" max="100" className={`${inputClass} mt-1 w-24`} /></label><label className="text-xs text-muted">ຮູບລົດ<input name="photo" type="file" accept="image/*" capture="environment" className={`${inputClass} mt-1`} /></label><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">{label}</button></form>; }

function HandoverPhoto({ label, url, mile }: { label: string; url: string | null; mile: number | null }) {
  return <div className="rounded-lg border border-slate-200 p-3">
    <p className="mb-2 text-xs font-medium text-muted">{label} · ໄມລ໌ {mile ?? "—"}</p>
    {url
      ? <a href={url} target="_blank" rel="noreferrer"><Image src={url} alt={label} width={320} height={160} unoptimized className="h-40 w-full rounded-md object-cover" /></a>
      : <div className="flex h-40 items-center justify-center rounded-md bg-slate-50 text-xs text-slate-400">ຍັງບໍ່ມີຮູບ</div>}
  </div>;
}
