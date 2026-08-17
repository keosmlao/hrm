import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, inputClass } from "@/components/ui";
import { monthlyUse } from "@/lib/fleet-live";
import { monthlyActualUse } from "@/lib/fleet-gps";
import { laoGpsConfigured } from "@/lib/laogps";
import PlanToolbar from "./toolbar";

export const dynamic = "force-dynamic";

/** ຝ່າຍຂາຍ — ຄ່າເລີ່ມຕົ້ນຂອງໜ້ານີ້ */
const DEFAULT_DIVISION = "200";
const WEEKDAY_SHORT = ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສຸ", "ສ"];
const LAO_MONTHS = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

function currentMonth() {
  return new Date().toLocaleDateString("en-CA").slice(0, 7);
}

/** ວັນນີ້ຕາມເວລາລາວ (YYYY-MM-DD) */
function laoToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

/** ວັນທັງໝົດຂອງເດືອນ ພ້ອມສະຖານະ: ວັນອາທິດ / ວັນນີ້ / ວັນທີ່ຜ່ານມາ */
function daysOfMonth(monthISO: string, todayISO: string) {
  const [y, m] = monthISO.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    const d = new Date(Date.UTC(y, m - 1, day));
    const iso = `${monthISO}-${String(day).padStart(2, "0")}`;
    return {
      day,
      iso,
      weekday: d.getUTCDay(),
      isSunday: d.getUTCDay() === 0,
      isToday: iso === todayISO,
      isPast: iso < todayISO,
    };
  });
}

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  return `${LAO_MONTHS[month - 1]} ${year}`;
}

export default async function MonthlyPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; div?: string; actual?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.month ?? "") ? q.month! : currentMonth();
  const divisionCode = q.div ?? DEFAULT_DIVISION;

  const [divisions, departments, uses] = await Promise.all([
    prisma.division.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, nameLo: true },
    }),
    prisma.department.findMany({ select: { code: true, nameLo: true, divisionCode: true } }),
    monthlyUse(month),
  ]);

  // ພະແນກຂອງຝ່າຍທີ່ເລືອກ → ໃຊ້ກັ່ນຕອງລົດ ("" = ທຸກຝ່າຍ)
  const deptMap = new Map(departments.map((d) => [d.code, d]));
  const deptCodes = departments.filter((d) => d.divisionCode === divisionCode).map((d) => d.code);

  const vehicles = await prisma.carVehicle.findMany({
    where: {
      status: { not: "retired" },
      ...(divisionCode ? { departmentCode: { in: deptCodes } } : {}),
    },
    select: { id: true, plateNo: true, name: true, departmentCode: true, gpsImei: true },
    orderBy: { plateNo: "asc" },
  });

  /**
   * ທຽບກັບການແລ່ນຈິງ — ເປັນ opt-in ເພາະຕ້ອງຍິງ GPS 1 ຄຳຂໍຕໍ່ລົດ
   * (ຝ່າຍຂາຍ 4 ຄັນ = ໄວ · ທຸກຝ່າຍ 27 ຄັນ = ຊ້າ) ຈຶ່ງບໍ່ເປີດໃຫ້ເອງ.
   */
  const withActual = q.actual === "1" && laoGpsConfigured();
  const imeis = vehicles.map((v) => v.gpsImei?.trim()).filter((x): x is string => Boolean(x));
  const actual = withActual ? await monthlyActualUse(imeis, month) : new Map();

  /** ໄລຍະທາງທີ່ແລ່ນຈິງໃນວັນນັ້ນ (ກມ) — null = ບໍ່ແລ່ນ ຫຼື ບໍ່ມີຂໍ້ມູນ */
  const ranKm = (imei: string | null, iso: string) =>
    imei ? (actual.get(imei.trim())?.get(iso) ?? null) : null;

  const todayISO = laoToday();
  const days = daysOfMonth(month, todayISO);
  const divisionName = divisions.find((d) => d.code === divisionCode)?.nameLo ?? "ທຸກຝ່າຍ";

  // ວັນທີ່ໃຊ້ + trip ຂອງແຕ່ລະລົດ: vehicleId → (ວັນ → trip)
  const usedBy = new Map<string, Map<string, (typeof uses)[number]>>();
  const tripsByVehicle = new Map<string, typeof uses>();
  for (const u of uses) {
    const perDay = usedBy.get(u.vehicleId) ?? new Map();
    for (const d of u.days) perDay.set(d, u);
    usedBy.set(u.vehicleId, perDay);
    const trips = tripsByVehicle.get(u.vehicleId) ?? [];
    trips.push(u);
    tripsByVehicle.set(u.vehicleId, trips);
  }

  const totalUsedDays = vehicles.reduce(
    (sum, v) => sum + (usedBy.get(v.id.toString())?.size ?? 0),
    0,
  );
  const plannedVehicles = vehicles.filter((v) => usedBy.has(v.id.toString())).length;
  const usedToday = vehicles.filter((v) => usedBy.get(v.id.toString())?.has(todayISO)).length;
  const utilization = vehicles.length
    ? Math.round((totalUsedDays / (vehicles.length * days.length)) * 100)
    : 0;

  // ສະຫຼຸບ ແຜນ vs ຈິງ — ນັບເປັນ "ວັນ-ຄັນ"
  let actualDays = 0;
  let unplannedDays = 0;
  let plannedNotRun = 0;
  if (withActual) {
    for (const v of vehicles) {
      const plan = usedBy.get(v.id.toString());
      for (const d of days) {
        const ran = ranKm(v.gpsImei, d.iso) != null;
        const planned = Boolean(plan?.has(d.iso));
        if (ran) actualDays += 1;
        if (ran && !planned) unplannedDays += 1;
        // ນັບສະເພາະວັນທີ່ຜ່ານມາແລ້ວ — ວັນຂ້າງໜ້າຍັງບໍ່ທັນຮອດ ຈຶ່ງບໍ່ຖືວ່າ "ບໍ່ແລ່ນ"
        if (!ran && planned && d.iso <= todayISO) plannedNotRun += 1;
      }
    }
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="ແຜນການນຳໃຊ້ລົດ ປະຈຳເດືອນ"
          subtitle="ເບິ່ງລົດວ່າງ, ລົດທີ່ຖືກຈອງ ແລະຊ່ວງເວລາຂອງແຕ່ລະ Trip ໃນບ່ອນດຽວ"
        />

        <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ເດືອນ</span>
            <input type="month" name="month" defaultValue={month} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ຝ່າຍ</span>
            <select name="div" defaultValue={divisionCode} className={`${inputClass} min-w-52`}>
              <option value="">ທຸກຝ່າຍ</option>
              {divisions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.nameLo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="actual" value="1" defaultChecked={withActual} />
            <span>
              ທຽບກັບການແລ່ນຈິງ (GPS)
              <span className="block text-[11px] text-muted">
                ດຶງ {vehicles.length} ຄຳຂໍ · ຊ້າຂຶ້ນເມື່ອລົດຫຼາຍ
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d3e55]"
          >
            ອັບເດດແຜນ
          </button>
          <PlanToolbar />
        </form>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        {[
          { label: "ລົດໃນແຜນ", value: `${vehicles.length} ຄັນ`, detail: divisionName, tone: "bg-primary/10 text-primary" },
          { label: "ມີແຜນເດືອນນີ້", value: `${plannedVehicles} ຄັນ`, detail: `${uses.length} Trip`, tone: "bg-blue-50 text-blue-700" },
          { label: "ກຳລັງໃຊ້ມື້ນີ້", value: `${usedToday} ຄັນ`, detail: `ວ່າງ ${Math.max(0, vehicles.length - usedToday)} ຄັນ`, tone: "bg-emerald-50 text-emerald-700" },
          withActual
            ? {
                label: "ແລ່ນຈິງ (GPS)",
                value: `${actualDays} ວັນ-ຄັນ`,
                detail:
                  unplannedDays > 0
                    ? `ບໍ່ມີແຜນ ${unplannedDays} · ມີແຜນແຕ່ບໍ່ແລ່ນ ${plannedNotRun}`
                    : `ມີແຜນແຕ່ບໍ່ແລ່ນ ${plannedNotRun}`,
                tone: unplannedDays > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
              }
            : { label: "ອັດຕາການໃຊ້", value: `${utilization}%`, detail: `${totalUsedDays} ວັນ-ຄັນ`, tone: "bg-amber-50 text-amber-700" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="mt-1 truncate text-xs text-muted">{stat.detail}</p>
              </div>
              <span className={`grid size-9 place-items-center rounded-xl ${stat.tone}`} aria-hidden="true">●</span>
            </div>
          </div>
        ))}
      </section>

      {vehicles.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          ບໍ່ມີລົດທີ່ລະບຸວ່າສັງກັດ{divisionName} — ໄປລະບຸພະແນກໃຫ້ລົດກ່ອນທີ່ໜ້າ “ຈັດການລົດ”
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="font-bold">{monthLabel(month)}</h2>
              <p className="text-xs text-muted">{divisionName} · ລາກແນວນອນເພື່ອເບິ່ງຄົບທຸກວັນ</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted print:hidden">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" /> ວ່າງ</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> ມີ Trip</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-400" /> ຜ່ານມາແລ້ວ</span>
              {withActual && (
                <>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> ແລ່ນຈິງຕາມແຜນ</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" /> ແລ່ນ ແຕ່ບໍ່ມີແຜນ</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-white ring-1 ring-rose-400" /> ມີແຜນ ແຕ່ບໍ່ແລ່ນ</span>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-max text-xs">
              <div
                className="sticky top-0 z-30 grid border-b border-border bg-slate-50/95 backdrop-blur"
                style={{ gridTemplateColumns: `220px repeat(${days.length}, 44px)` }}
              >
                <div className="sticky left-0 z-40 flex items-center border-r border-border bg-slate-50 px-4 py-3 font-semibold">
                  ລົດ / ພະແນກ
                </div>
                {days.map((d) => (
                  <div
                    key={d.iso}
                    className={`border-r border-border/70 py-2 text-center ${
                      d.isToday
                        ? "bg-primary text-white"
                        : d.isSunday
                          ? "bg-rose-50 text-rose-500"
                          : d.isPast
                            ? "text-slate-400"
                            : "text-slate-700"
                    }`}
                  >
                    <span className="block text-[9px] font-medium">{WEEKDAY_SHORT[d.weekday]}</span>
                    <span className="tabular mt-0.5 block text-sm font-bold">{d.day}</span>
                  </div>
                ))}
              </div>

              {vehicles.map((v) => {
                const vehicleId = v.id.toString();
                const dept = v.departmentCode ? deptMap.get(v.departmentCode) : undefined;
                const vehicleTrips = tripsByVehicle.get(vehicleId) ?? [];
                const usedDays = usedBy.get(vehicleId)?.size ?? 0;
                const freeDays = Math.max(0, days.length - usedDays);
                return (
                  <div
                    key={vehicleId}
                    className="relative grid min-h-16 border-b border-border/80 last:border-b-0 hover:bg-primary/[0.015]"
                    style={{ gridTemplateColumns: `220px repeat(${days.length}, 44px)` }}
                  >
                    <div className="sticky left-0 z-30 flex min-w-0 items-center border-r border-border bg-card px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{v.plateNo}</p>
                        <p className="truncate text-[10px] text-muted">{v.name}{dept ? ` · ${dept.nameLo}` : ""}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">ວ່າງ {freeDays} ມື້</p>
                      </div>
                    </div>

                    {days.map((d, index) => {
                      const km = withActual ? ranKm(v.gpsImei, d.iso) : null;
                      const planned = Boolean(usedBy.get(vehicleId)?.has(d.iso));
                      return (
                        <div
                          key={d.iso}
                          style={{ gridColumn: index + 2, gridRow: 1 }}
                          className={`relative border-r border-border/60 ${
                            planned
                              ? d.isPast
                                ? "bg-slate-50/60"
                                : d.isSunday
                                  ? "bg-rose-50/60"
                                  : ""
                              : d.isPast
                                ? "bg-emerald-50/40"
                                : "bg-emerald-50/90"
                          } ${
                            d.isToday ? "ring-2 ring-inset ring-primary/55" : ""
                          }`}
                        >
                          {!planned && (
                            <span
                              title={`${v.plateNo} ວ່າງວັນທີ ${d.iso}`}
                              className={`absolute inset-0 grid place-items-center text-sm font-bold text-emerald-500 ${
                                d.isPast ? "opacity-35" : "opacity-80"
                              }`}
                            >
                              ✓
                            </span>
                          )}
                          {/* ຈຸດລຸ່ມຊ່ອງ = ຂໍ້ມູນຈາກ GPS ວ່າແລ່ນຈິງບໍ (ຢູ່ລຸ່ມແຖບ Trip) */}
                          {km != null && (
                            <span
                              title={`ແລ່ນຈິງ ${km.toFixed(1)} ກມ${planned ? "" : " · ບໍ່ມີແຜນນຳໃຊ້"}`}
                              className={`absolute bottom-1 left-1/2 z-20 size-2 -translate-x-1/2 rounded-full ring-1 ring-white ${
                                planned ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                          )}
                          {withActual && km == null && planned && (
                            <span
                              title="ມີແຜນ ແຕ່ GPS ບໍ່ພົບການເຄື່ອນໄຫວ"
                              className="absolute bottom-1 left-1/2 z-20 size-2 -translate-x-1/2 rounded-full bg-white ring-1 ring-rose-400"
                            />
                          )}
                        </div>
                      );
                    })}

                    {vehicleTrips.map((trip) => {
                      const startIndex = days.findIndex((d) => d.iso === trip.days[0]);
                      if (startIndex < 0) return null;
                      const span = trip.days.length;
                      const includesToday = trip.days.includes(todayISO);
                      const isPast = trip.days.at(-1)! < todayISO;
                      const title = `${trip.destination}${trip.driverName ? ` · ${trip.driverName}` : ""}${trip.departTime || trip.returnTime ? ` · ${trip.departTime ?? "—"}–${trip.returnTime ?? "—"}` : ""}`;
                      return (
                        <Link
                          key={trip.tripId}
                          href={`/fleet/trips/${trip.tripId}`}
                          title={title}
                          style={{ gridColumn: `${startIndex + 2} / span ${span}`, gridRow: 1 }}
                          className={`z-10 mx-1 my-2 flex min-w-0 items-center overflow-hidden rounded-lg px-2.5 shadow-sm ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-md ${
                            includesToday
                              ? "bg-emerald-500 text-white ring-emerald-600/30"
                              : isPast
                                ? "bg-slate-200 text-slate-700 ring-slate-300"
                                : "bg-primary text-white ring-black/10"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{trip.destination || "Trip"}</p>
                            {span >= 3 && (
                              <p className={`truncate text-[9px] ${isPast && !includesToday ? "text-slate-500" : "text-white/75"}`}>
                                {trip.driverName ?? "ຍັງບໍ່ມີຄົນຂັບ"}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted print:hidden">
        <span>ສະແດງສະເພາະ Trip ທີ່ອະນຸມັດ ແລະຈັດລົດແລ້ວ</span>
        <span>·</span>
        <span>ກົດແຖບ Trip ເພື່ອເບິ່ງ/ຈັດການລາຍລະອຽດ</span>
      </div>
    </>
  );
}
