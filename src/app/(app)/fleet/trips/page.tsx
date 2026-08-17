import { prisma } from "@/lib/prisma";
import { requireRole, hasRole } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { laoDate } from "@/lib/format";
import { dateKey, laoWorkDate } from "@/lib/attendance";
import { tripScheduleLabel } from "@/lib/trip";
import { TripCreateModal } from "../trip-create-modal";
import { TripAssignForm } from "../trip-assign-form";
import { TripEditActions } from "../trip-edit-actions";
import { updateTripStatus, rejectTrip, approveTripStep } from "../actions";
import { currentStepInfo, canApproveStep, APPROVER_TYPE_LABEL } from "@/lib/trip-approvals";
import Link from "next/link";

export const dynamic = "force-dynamic";

const LAO_MONTHS = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];
const WEEKDAY_SHORT = ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສຸ", "ສ"];

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  return `${LAO_MONTHS[month - 1]} ${year}`;
}

function monthRange(monthISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    startISO: `${monthISO}-01`,
    endISO: `${monthISO}-${String(lastDay).padStart(2, "0")}`,
  };
}

function daysOfMonth(monthISO: string, todayISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const date = new Date(Date.UTC(year, month - 1, day));
    const iso = `${monthISO}-${String(day).padStart(2, "0")}`;
    return {
      day,
      iso,
      weekday: date.getUTCDay(),
      isSunday: date.getUTCDay() === 0,
      isToday: iso === todayISO,
      isPast: iso < todayISO,
    };
  });
}

const TRIP_STATUS: Record<string, { label: string; tone: "amber" | "blue" | "green" | "gray" }> = {
  PLANNED: { label: "ວາງແຜນ", tone: "amber" },
  DEPARTED: { label: "ອອກແລ້ວ", tone: "blue" },
  IN_PROGRESS: { label: "ກຳລັງຂາຍ", tone: "blue" },
  RETURNED: { label: "ກັບແລ້ວ", tone: "green" },
  CLOSED: { label: "ປິດ Trip ແລ້ວ", tone: "green" },
  CANCELLED: { label: "ຍົກເລີກ", tone: "gray" },
};

// Sale trip ໃຊ້ workflowStatus (PLANNED→DEPARTED→IN_PROGRESS→RETURNED→CLOSED) · Trip ທົ່ວໄປໃຊ້ status
function tripStatusBadge(tripType: string, status: string, workflowStatus: string) {
  const key = tripType === "SALE" ? workflowStatus : status;
  return TRIP_STATUS[key] ?? { label: key, tone: "gray" as const };
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const session = await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const canManage = hasRole(session, "ADMIN", "HR", "MANAGER");
  const { month: monthParam, date: legacyDateParam } = await searchParams;
  const today = dateKey(laoWorkDate(new Date()));
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? (monthParam as string)
    : /^\d{4}-\d{2}-\d{2}$/.test(legacyDateParam ?? "")
      ? (legacyDateParam as string).slice(0, 7)
      : today.slice(0, 7);
  const { startISO, endISO } = monthRange(month);
  const defaultTripDate = month === today.slice(0, 7) ? today : startISO;

  const [vehicles, employees, trips, salesDepartments] = await Promise.all([
    prisma.carVehicle.findMany({
      where: { status: { not: "retired" } },
      orderBy: { plateNo: "asc" },
    }),
    prisma.employee.findMany({
      where: { employmentStatus: "ACTIVE" },
      select: { code: true, fullnameLo: true },
      orderBy: { code: "asc" },
    }),
    prisma.vehicleTrip.findMany({
      where: {
        // ລວມທັງ trip ທີ່ເລີ່ມກ່ອນເດືອນ ແຕ່ຍັງຄາບເຂົ້າມາໃນເດືອນນີ້.
        date: { lte: new Date(`${endISO}T00:00:00Z`) },
        endDate: { gte: new Date(`${startISO}T00:00:00Z`) },
      },
      include: {
        driver: { select: { fullnameLo: true } },
        requestedBy: { select: { fullnameLo: true } },
        members: { include: { employee: { select: { fullnameLo: true } } } },
      },
      orderBy: [{ date: "asc" }, { departTime: "asc" }, { vehicleId: "asc" }],
    }),
    prisma.department.findMany({
      where: { divisionCode: "200" },
      select: { code: true },
    }),
  ]);

  // ອ້າງອີງລົດຈາກ ERP: vehicleId (string) = app_car_vehicles.id
  const vehMap = new Map(vehicles.map((v) => [v.id.toString(), v]));

  // ຄຳຮ້ອງລໍຖ້າ (approvedAt == null, ຍັງບໍ່ຖືກປະຕິເສດ) vs trip ທີ່ອະນຸມັດແລ້ວ
  const pending = trips.filter((t) => t.approvedAt === null && t.status !== "CANCELLED");
  const scheduled = trips.filter((t) => t.approvedAt !== null);
  const salesDepartmentCodes = new Set(salesDepartments.map((department) => department.code));
  const salesVehicles = vehicles.filter(
    (vehicle) => vehicle.departmentCode && salesDepartmentCodes.has(vehicle.departmentCode),
  );
  const days = daysOfMonth(month, today);

  // vehicle → day → trip(s). ນັບສະເພາະ trip ທີ່ອະນຸມັດ, ຈັດລົດ ແລະບໍ່ຖືກຍົກເລີກ.
  const planByVehicle = new Map<string, Map<string, typeof scheduled>>();
  for (const trip of scheduled) {
    if (!trip.vehicleId || trip.status === "CANCELLED") continue;
    const from = trip.date < new Date(`${startISO}T00:00:00Z`)
      ? new Date(`${startISO}T00:00:00Z`)
      : new Date(trip.date);
    const to = trip.endDate > new Date(`${endISO}T00:00:00Z`)
      ? new Date(`${endISO}T00:00:00Z`)
      : new Date(trip.endDate);
    const perDay = planByVehicle.get(trip.vehicleId) ?? new Map<string, typeof scheduled>();
    for (const cursor = from; cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const iso = cursor.toISOString().slice(0, 10);
      perDay.set(iso, [...(perDay.get(iso) ?? []), trip]);
    }
    planByVehicle.set(trip.vehicleId, perDay);
  }

  const empOptions = employees.map((e) => ({ value: e.code, label: `${e.code} · ${e.fullnameLo}` }));
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id.toString(),
    label: `${v.plateNo} · ${v.name}`,
  }));

  // ຂໍ້ມູນຂັ້ນອະນຸມັດ ຂອງແຕ່ລະຄຳຮ້ອງ
  const empName = new Map(employees.map((e) => [e.code, e.fullnameLo]));
  const pendingInfo = await Promise.all(pending.map(async (t) => {
    const info = await currentStepInfo(t);
    return {
      t,
      done: info.done,
      totalSteps: info.totalSteps,
      currentLabel: info.currentStep ? (APPROVER_TYPE_LABEL[info.currentStep.approverType] ?? info.currentStep.approverType) : null,
      approverNames: [...info.approvers].map((c) => empName.get(c) ?? c),
      canApprove: !info.done && canApproveStep(session, info.approvers),
    };
  }));

  return (
    <>
      <PageHeader
        title="ລາຍການ ແລະ ແຜນນຳໃຊ້ລົດ"
        subtitle={`ເບິ່ງມື້ວ່າງຂອງລົດຝ່າຍຂາຍ ແລະ Trip ທັງເດືອນ · ${monthLabel(month)}`}
      />

      <form className="mb-5 flex flex-wrap items-center gap-3">
        <input type="month" name="month" defaultValue={month} className={`${inputClass} max-w-48`} />
        <button className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-slate-50">
          ສະແດງ
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <a href="#monthly-plan" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
          ແຜນ / ມື້ວ່າງ
        </a>
        <a href="#trip-list" className="rounded-lg border border-border bg-card px-4 py-2 font-semibold hover:bg-slate-50">
          ລາຍການ Trip
        </a>
      </div>

      <section id="monthly-plan" className="mb-8 scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-bold">ແຜນລົດຝ່າຍຂາຍ · {monthLabel(month)}</h2>
            <p className="text-xs text-muted">ສີຂຽວ ✓ = ວ່າງ · ສີມ່ວງ = ມີ Trip · ເລື່ອນແນວນອນເພື່ອເບິ່ງຄົບທຸກວັນ</p>
          </div>
          <Link href={`/fleet/monthly-plan?month=${month}&div=200`} className="text-xs font-semibold text-primary hover:underline">
            ເບິ່ງແຜນລະອຽດ / GPS →
          </Link>
        </div>

        {salesVehicles.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">ບໍ່ພົບລົດທີ່ລະບຸວ່າສັງກັດຝ່າຍຂາຍ</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-max text-xs">
              <div
                className="grid border-b border-border bg-slate-50"
                style={{ gridTemplateColumns: `220px repeat(${days.length}, 42px)` }}
              >
                <div className="sticky left-0 z-40 flex items-center border-r border-border bg-slate-50 px-4 py-3 font-semibold">
                  ລົດຝ່າຍຂາຍ
                </div>
                {days.map((day) => (
                  <div
                    key={day.iso}
                    className={`border-r border-border/70 py-2 text-center ${
                      day.isToday
                        ? "bg-primary text-white"
                        : day.isSunday
                          ? "bg-rose-50 text-rose-500"
                          : "text-slate-700"
                    }`}
                  >
                    <span className="block text-[9px]">{WEEKDAY_SHORT[day.weekday]}</span>
                    <span className="tabular block text-sm font-bold">{day.day}</span>
                  </div>
                ))}
              </div>

              {salesVehicles.map((vehicle) => {
                const vehicleId = vehicle.id.toString();
                const perDay = planByVehicle.get(vehicleId);
                const freeDays = days.length - (perDay?.size ?? 0);
                return (
                  <div
                    key={vehicleId}
                    className="grid min-h-16 border-b border-border/80 last:border-b-0"
                    style={{ gridTemplateColumns: `220px repeat(${days.length}, 42px)` }}
                  >
                    <div className="sticky left-0 z-30 flex items-center border-r border-border bg-card px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{vehicle.plateNo}</p>
                        <p className="truncate text-[10px] text-muted">{vehicle.name}</p>
                        <p className="text-[10px] font-semibold text-emerald-600">ວ່າງ {freeDays} ມື້</p>
                      </div>
                    </div>
                    {days.map((day) => {
                      const dayTrips = perDay?.get(day.iso) ?? [];
                      const free = dayTrips.length === 0;
                      const title = free
                        ? `${vehicle.plateNo} ວ່າງວັນທີ ${day.iso}`
                        : dayTrips.map((trip) => `${trip.destination} ${trip.departTime ?? ""}–${trip.returnTime ?? ""}`).join("\n");
                      const cellClass = `relative grid place-items-center border-r border-border/60 font-bold ${
                        free
                          ? `bg-emerald-50 text-emerald-500 ${day.isPast ? "opacity-45" : ""}`
                          : day.isPast
                            ? "bg-slate-300 text-slate-700"
                            : "bg-primary text-white"
                      } ${day.isToday ? "ring-2 ring-inset ring-primary/60" : ""}`;
                      return free ? (
                        <div key={day.iso} title={title} className={cellClass}>✓</div>
                      ) : (
                        <Link key={day.iso} href={`/fleet/trips/${dayTrips[0].id}`} title={title} className={cellClass}>
                          {dayTrips.length > 1 ? dayTrips.length : "●"}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ຄຳຮ້ອງຈາກພະນັກງານ (LINE) ທີ່ລໍຖ້າຈັດລົດ + ອະນຸມັດ */}
      {pending.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/40">
          <h2 className="mb-4 font-semibold text-amber-800">
            ຄຳຮ້ອງລໍຖ້າຈັດລົດ ({pending.length})
          </h2>
          <div className="space-y-4">
            {pendingInfo.map(({ t, done, totalSteps, currentLabel, approverNames, canApprove }) => (
              <div key={t.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t.destination}</p>
                    <p className="text-xs text-muted">
                      ຮ້ອງຂໍໂດຍ {t.requestedBy?.fullnameLo ?? "-"}
                      {` · ${tripScheduleLabel(t.date, t.endDate, t.departTime, t.returnTime, laoDate)}`}
                      {` · ຄັ້ງທີ ${t.tripNo}`}
                    </p>
                    {t.members.length > 0 && (
                      <p className="mt-1 text-xs text-muted">
                        ຄົນໄປ: {t.members.map((m) => m.employee.fullnameLo).join(", ")}
                      </p>
                    )}
                    {t.note && <p className="mt-1 text-xs text-muted">ໝາຍເຫດ: {t.note}</p>}
                  </div>
                  <form action={rejectTrip.bind(null, t.id)} className="flex gap-1">
                    <input name="reason" required placeholder="ເຫດຜົນ" className="w-28 rounded border border-border px-2 py-1 text-xs" />
                    <button className="text-xs text-muted hover:text-rose-600 hover:underline">ປະຕິເສດ</button>
                  </form>
                </div>

                {/* ຂັ້ນຕອນອະນຸມັດ */}
                <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs">
                  {totalSteps === 0 ? (
                    <span className="text-emerald-700">ບໍ່ມີຂັ້ນອະນຸມັດ — admin ຈັດລົດໄດ້ເລີຍ</span>
                  ) : done ? (
                    <span className="font-medium text-emerald-700">✓ ອະນຸມັດຄົບ {totalSteps} ຂັ້ນ — ພ້ອມຈັດລົດ</span>
                  ) : (
                    <span>
                      ຂັ້ນ <span className="font-medium">{t.approvalLevel + 1}/{totalSteps}</span> · ລໍຖ້າ <span className="font-medium">{currentLabel}</span>
                      {approverNames.length > 0 ? ` (${approverNames.join(", ")})` : " — ຍັງບໍ່ໄດ້ກຳນົດຫົວໜ້າ node ນີ້"}
                    </span>
                  )}
                </div>

                {!done && canApprove && (
                  <form action={approveTripStep.bind(null, t.id)} className="mb-3">
                    <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">✓ ອະນຸມັດຂັ້ນນີ້</button>
                  </form>
                )}

                {done && (
                  <TripAssignForm
                    tripId={t.id}
                    defaultTripNo={t.tripNo}
                    vehicles={vehicleOptions}
                    employees={empOptions}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6">
        <TripCreateModal vehicles={vehicleOptions} employees={empOptions} defaultDate={defaultTripDate} />
      </div>

      <h2 id="trip-list" className="mb-3 scroll-mt-4 font-semibold">Trip ປະຈຳເດືອນ {monthLabel(month)} ({scheduled.length})</h2>
      <Table>
        <thead>
          <tr>
            <Th className="text-center">ທິບ</Th>
            <Th>ລົດ</Th>
            <Th>ຄົນຂັບ</Th>
            <Th>ຕະຫຼາດ / ເສັ້ນທາງ</Th>
            <Th>ວັນ–ເວລາ</Th>
            <Th>ພະນັກງານໄປ</Th>
            <Th>ສະຖານະ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {scheduled.length === 0 && <EmptyRow colSpan={8} text={`ບໍ່ມີ Trip ໃນເດືອນ ${monthLabel(month)}`} />}
          {scheduled.map((t) => {
            const veh = t.vehicleId ? vehMap.get(t.vehicleId) : undefined;
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <Td className="text-center tabular font-medium">{t.tripNo}</Td>
                <Td className="whitespace-nowrap">
                  <span className="font-medium">{veh?.plateNo ?? "?"}</span>
                  <span className="block text-xs text-muted">{veh?.name ?? t.vehicleId ?? "—"}</span>
                </Td>
                <Td className="text-sm">{t.driver?.fullnameLo ?? "-"}</Td>
                <Td><Link href={`/fleet/trips/${t.id}`} className="font-medium text-primary hover:underline">{t.destination}</Link>{t.tripType === "SALE" && <Badge tone="green">Sale</Badge>}</Td>
                <Td className="whitespace-nowrap text-xs">{tripScheduleLabel(t.date, t.endDate, t.departTime, t.returnTime, laoDate)}</Td>
                <Td className="text-xs text-muted">
                  {t.members.length === 0 ? "-" : t.members.map((m) => m.employee.fullnameLo).join(", ")}
                </Td>
                <Td>
                  {(() => { const st = tripStatusBadge(t.tripType, t.status, t.workflowStatus); return <Badge tone={st.tone}>{st.label}</Badge>; })()}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {t.tripType === "SALE" && <Link href={`/fleet/trips/${t.id}`} className="text-xs font-medium text-primary hover:underline">ຈັດການ Sale</Link>}
                    {t.tripType !== "SALE" && t.status === "PLANNED" && (
                      <form action={updateTripStatus.bind(null, t.id, "DEPARTED")}>
                        <button className="text-xs font-medium text-blue-600 hover:underline">ອອກ</button>
                      </form>
                    )}
                    {t.tripType !== "SALE" && t.status === "DEPARTED" && (
                      <form action={updateTripStatus.bind(null, t.id, "RETURNED")}>
                        <button className="text-xs font-medium text-emerald-600 hover:underline">ກັບ</button>
                      </form>
                    )}
                    {t.tripType !== "SALE" && t.status !== "CANCELLED" && t.status !== "RETURNED" && (
                      <form action={updateTripStatus.bind(null, t.id, "CANCELLED")}>
                        <button className="text-xs text-muted hover:text-rose-600 hover:underline">ຍົກເລີກ</button>
                      </form>
                    )}
                    {canManage && <TripEditActions tripId={t.id} editable={t.workflowStatus !== "CLOSED" && t.status !== "CANCELLED"} vehicles={vehicleOptions} employees={empOptions} defaults={{ destination: t.destination, date: t.date.toISOString().slice(0, 10), endDate: t.endDate.toISOString().slice(0, 10), departTime: t.departTime ?? "", returnTime: t.returnTime ?? "", vehicleId: t.vehicleId ?? "", driverCode: t.driverCode ?? "", note: t.note ?? "" }} />}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
