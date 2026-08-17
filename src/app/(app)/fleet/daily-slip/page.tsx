import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, hasRole } from "@/lib/auth";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui";
import { dailyUseSlips, type UseSlip } from "@/lib/fleet-live";
import { TripCreateModal } from "../trip-create-modal";
import { TripEditActions } from "../trip-edit-actions";
import SlipToolbar from "./toolbar";

export const dynamic = "force-dynamic";

/** ຝ່າຍຂາຍ — ໜ້ານີ້ອອກໃບໃຫ້ສະເພາະລົດຂອງຝ່າຍນີ້ */
const SALES_DIVISION = "200";

function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

export default async function DailySlipPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const canCreate = hasRole(session, "ADMIN", "HR", "MANAGER");
  const { date } = await searchParams;
  const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? (date as string) : todayISO();

  // ພະແນກຂອງຝ່າຍຂາຍ — ໃຊ້ກັ່ນຕອງລົດໃນຟອມສ້າງໃບ
  const salesDepts = await prisma.department.findMany({
    where: { divisionCode: SALES_DIVISION },
    select: { code: true },
  });

  const [slips, vehicles, employees, pending] = await Promise.all([
    dailyUseSlips(dateISO),
    prisma.carVehicle.findMany({
      where: {
        status: { not: "retired" },
        departmentCode: { in: salesDepts.map((d) => d.code) },
      },
      select: { id: true, plateNo: true, name: true },
      orderBy: { plateNo: "asc" },
    }),
    prisma.employee.findMany({
      where: { employmentStatus: "ACTIVE" },
      select: { code: true, fullnameLo: true },
      orderBy: { code: "asc" },
    }),
    // trip ທີ່ຄຸມວັນນີ້ ແຕ່ຍັງບໍ່ອອກໃບໄດ້ — ບອກໃຫ້ຮູ້ວ່າຄ້າງຢູ່ຂັ້ນໃດ
    prisma.vehicleTrip.findMany({
      where: {
        date: { lte: new Date(`${dateISO}T00:00:00Z`) },
        endDate: { gte: new Date(`${dateISO}T00:00:00Z`) },
        status: { not: "CANCELLED" },
        OR: [{ approvedAt: null }, { vehicleId: null }],
      },
      select: { id: true, destination: true, approvedAt: true, vehicleId: true },
      orderBy: { tripNo: "asc" },
    }),
  ]);

  // ຄ່າດິບຂອງ trip ໃນວັນນັ້ນ — ຟອມແກ້ໄຂຕ້ອງການວັນທີແບບ ISO ບໍ່ແມ່ນ DD/MM/YYYY
  const rawTrips = await prisma.vehicleTrip.findMany({
    where: {
      date: { lte: new Date(`${dateISO}T00:00:00Z`) },
      endDate: { gte: new Date(`${dateISO}T00:00:00Z`) },
      status: { not: "CANCELLED" },
      approvedAt: { not: null },
      vehicleId: { not: null },
    },
    select: {
      id: true,
      destination: true,
      date: true,
      endDate: true,
      departTime: true,
      returnTime: true,
      vehicleId: true,
      driverCode: true,
      note: true,
      workflowStatus: true,
      status: true,
    },
  });
  const rawMap = new Map(rawTrips.map((t) => [t.id, t]));

  // ຟອມ **ສ້າງ** ໃຊ້ສະເພາະລົດຝ່າຍຂາຍ
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id.toString(),
    label: `${v.plateNo} · ${v.name}`,
  }));

  // ຟອມ **ແກ້ໄຂ** ຕ້ອງມີລົດຄົບທຸກຄັນ ບໍ່ດັ່ງນັ້ນໃບເກົ່າທີ່ໃຊ້ລົດຝ່າຍອື່ນຈະຫາລົດຕົນເອງບໍ່ພົບ
  const allVehicles = await prisma.carVehicle.findMany({
    where: { status: { not: "retired" } },
    select: { id: true, plateNo: true, name: true },
    orderBy: { plateNo: "asc" },
  });
  const allVehicleOptions = allVehicles.map((v) => ({
    value: v.id.toString(),
    label: `${v.plateNo} · ${v.name}`,
  }));
  const empOptions = employees.map((e) => ({ value: e.code, label: `${e.code} · ${e.fullnameLo}` }));

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="ລາຍການໃບນຳໃຊ້ລົດ"
          subtitle="ໃບທີ່ອອກໃຫ້ຜູ້ຢືມ/ຄົນຂັບ ທີ່ໄດ້ຮັບອະນຸມັດນຳໃຊ້ລົດ ໃນວັນທີທີ່ເລືອກ · ສ້າງໃບໄດ້ສະເພາະລົດຝ່າຍຂາຍ"
          action={
            !canCreate ? undefined : vehicleOptions.length === 0 ? (
              <Link
                href="/fleet/vehicles"
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                ຍັງບໍ່ມີລົດຝ່າຍຂາຍ — ໄປລະບຸພະແນກໃຫ້ລົດ →
              </Link>
            ) : (
              <TripCreateModal
                vehicles={vehicleOptions}
                employees={empOptions}
                defaultDate={dateISO}
                label="+ ສ້າງໃບນຳໃຊ້ລົດ"
                title="ສ້າງໃບນຳໃຊ້ລົດ (ລົດຝ່າຍຂາຍ)"
                returnTo="daily-slip"
              />
            )
          }
        />
      </div>
      <SlipToolbar date={dateISO} />

      {slips.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center print:hidden">
          <p className="text-sm text-muted">ບໍ່ມີລົດທີ່ອະນຸມັດນຳໃຊ້ໃນວັນທີ {dateISO}</p>

          {pending.length > 0 ? (
            <div className="mx-auto mt-4 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
              <p className="font-semibold">ມີ {pending.length} ລາຍການຄ້າງຢູ່ — ຍັງອອກໃບບໍ່ໄດ້</p>
              <ul className="mt-2 space-y-1 text-xs">
                {pending.map((t) => (
                  <li key={t.id}>
                    {t.destination || "ບໍ່ລະບຸຈຸດໝາຍ"} —{" "}
                    {!t.approvedAt ? "ລໍຖ້າອະນຸມັດ" : "ອະນຸມັດແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ຈັດລົດ"}
                  </li>
                ))}
              </ul>
              <Link
                href={`/fleet/trips?date=${dateISO}`}
                className="mt-3 inline-block font-semibold text-primary hover:underline"
              >
                ໄປຈັດການທີ່ໜ້າລາຍການນຳໃຊ້ລົດ →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">
              ໃບຈະຂຶ້ນເມື່ອ trip ໄດ້ຮັບ <strong>ອະນຸມັດ</strong> ແລະ <strong>ຈັດລົດ</strong> ແລ້ວ
              {canCreate ? " — ກົດ “ສ້າງໃບນຳໃຊ້ລົດ” ຂ້າງເທິງເພື່ອເລີ່ມ" : ""}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* ໜ້າຈໍ: ລາຍການແບບຕາຕະລາງ */}
          <div className="print:hidden">
            <Table>
              <thead>
                <tr>
                  <Th>Trip</Th>
                  <Th>ລົດ</Th>
                  <Th>ຄົນຂັບ / ຜູ້ຮັບຜິດຊອບ</Th>
                  <Th>ຈຸດໝາຍ</Th>
                  <Th>ໄລຍະ</Th>
                  <Th>ເວລາ</Th>
                  <Th>ປະເພດ</Th>
                  <Th>ອະນຸມັດ</Th>
                  {canCreate && <Th />}
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.tripId}>
                    <Td className="tabular font-medium">#{s.tripNo}</Td>
                    <Td>
                      <span className="font-medium">{s.vehiclePlate ?? "—"}</span>
                      {s.vehicleName && (
                        <span className="block text-xs text-muted">{s.vehicleName}</span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      <span className="block font-medium text-foreground">{s.driverName ?? "—"}</span>
                      {s.borrowerName && <span className="block text-muted">ຢືມ: {s.borrowerName}</span>}
                      {s.members.length > 0 && (
                        <span className="block text-muted">+{s.members.length} ຄົນຮ່ວມ</span>
                      )}
                    </Td>
                    <Td>
                      {s.destination || "—"}
                      {s.note && <span className="block text-xs text-muted">{s.note}</span>}
                    </Td>
                    <Td className="tabular text-xs">
                      {s.date === s.endDate ? s.date : `${s.date} – ${s.endDate}`}
                    </Td>
                    <Td className="tabular text-xs">
                      {s.departTime ?? "—"} – {s.returnTime ?? "—"}
                    </Td>
                    <Td>
                      <Badge tone={s.isBorrower ? "amber" : "green"}>
                        {s.isBorrower ? "ຜູ້ຢືມລົດ" : "ຕາມໜ້າວຽກ"}
                      </Badge>
                      {s.tripType === "SALE" && (
                        <span className="ml-1 text-xs text-muted">ອອກຕະຫຼາດ</span>
                      )}
                    </Td>
                    <Td className="tabular text-xs text-muted">{s.approvedAt ?? "—"}</Td>
                    {canCreate &&
                      (() => {
                        const t = rawMap.get(s.tripId);
                        return (
                          <Td className="text-right">
                            {t && (
                              <TripEditActions
                                tripId={t.id}
                                editable={t.workflowStatus !== "CLOSED" && t.status !== "CANCELLED"}
                                vehicles={allVehicleOptions}
                                employees={empOptions}
                                defaults={{
                                  destination: t.destination,
                                  date: t.date.toISOString().slice(0, 10),
                                  endDate: t.endDate.toISOString().slice(0, 10),
                                  departTime: t.departTime ?? "",
                                  returnTime: t.returnTime ?? "",
                                  vehicleId: t.vehicleId ?? "",
                                  driverCode: t.driverCode ?? "",
                                  note: t.note ?? "",
                                }}
                              />
                            )}
                          </Td>
                        );
                      })()}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-xs text-muted">
              {slips.length} ໃບ · ກົດ “ພິມໃບນຳໃຊ້ລົດ” ເພື່ອພິມເປັນໃບເຕັມ (1 ໃບຕໍ່ໜ້າ)
            </p>
          </div>

          {/* ພິມ: ໃບເຕັມພ້ອມຊ່ອງເຊັນ — ບໍ່ສະແດງເທິງໜ້າຈໍ */}
          <div className="hidden print:block">
            {slips.map((s) => (
              <Slip key={s.tripId} s={s} dateISO={dateISO} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

function Slip({ s, dateISO }: { s: UseSlip; dateISO: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 text-sm shadow-[0_1px_2px_rgba(44,30,42,0.05)] print:break-inside-avoid print:break-after-page print:border-0 print:shadow-none">
      <header className="mb-4 flex items-start justify-between border-b border-border pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">ODIEN GROUP · ຝ່າຍລົດ</p>
          <h2 className="text-lg font-bold">ໃບນຳໃຊ້ລົດ ປະຈຳວັນ</h2>
          <p className="text-xs text-muted">ວັນທີ {dateISO} · Trip #{s.tripNo}{s.tripType === "SALE" ? " · ອອກຕະຫຼາດ" : ""}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.isBorrower ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
            {s.isBorrower ? "ຜູ້ຢືມລົດ" : "ໃຊ້ຕາມໜ້າວຽກ"}
          </span>
        </div>
      </header>

      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Row label="ລົດ" value={[s.vehiclePlate, s.vehicleName].filter(Boolean).join(" · ")} />
        <Row label="ຄົນຂັບ" value={[s.driverName, s.driverCode].filter(Boolean).join(" · ")} />
        <Row label="ຜູ້ຮັບຜິດຊອບ" value={[s.borrowerName, s.borrowerCode].filter(Boolean).join(" · ")} />
        <Row label="ອະນຸມັດ" value={s.approvedAt ?? "—"} />
        <Row label="ຈຸດໝາຍ" value={s.destination} />
        <Row label="ໄລຍະ" value={s.date === s.endDate ? s.date : `${s.date} – ${s.endDate}`} />
        <Row label="ເວລາອອກ" value={s.departTime ?? "—"} />
        <Row label="ເວລາກັບ" value={s.returnTime ?? "—"} />
      </div>

      {s.members.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <Row label="ຜູ້ຮ່ວມເດີນທາງ" value={s.members.join(", ")} />
        </div>
      )}
      {s.note && (
        <div className="mt-1">
          <Row label="ໝາຍເຫດ" value={s.note} />
        </div>
      )}

      <footer className="mt-6 grid grid-cols-3 gap-6 text-center text-xs text-muted">
        {["ຜູ້ນຳໃຊ້ / ຄົນຂັບ", "ຜູ້ອະນຸມັດ", "ຝ່າຍລົດ / ຮັບຄືນ"].map((label) => (
          <div key={label}>
            <div className="mb-1 h-10 border-b border-dashed border-slate-400" />
            {label}
          </div>
        ))}
      </footer>
    </article>
  );
}
