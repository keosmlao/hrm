import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, inputClass } from "@/components/ui";
import {
  laoGpsConfigured,
  laoGpsErrorMessage,
  listDriverBehaviour,
} from "@/lib/laogps";
import { gpsVehicleOptions, hours, num } from "@/lib/fleet-gps";
import { GpsNotConfigured, GpsNotice } from "../gps-filter";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const LAO_MONTHS = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

/**
 * LaoGPS ຕ້ອງຄຳນວນລາຍງານລົດທຸກຄັນໃນ tracking store ແລະອາດຕອບ
 * HTTP 202 ຫຼາຍຮອບ. ເກັບສະເພາະຜົນທີ່ຄຳນວນສຳເລັດແລ້ວຕາມ from/to,
 * ເພື່ອບໍ່ໃຫ້ຜູ້ໃຊ້ທຸກຄົນລໍຖ້າລາຍງານຊຸດເດີມຊ້ຳໆ.
 */
const currentMonthReport = unstable_cache(
  (from: string, to: string) => listDriverBehaviour({ from, to }),
  ["gps-monthly-summary-current-v1"],
  { revalidate: 5 * 60 },
);

const historicalMonthReport = unstable_cache(
  (from: string, to: string) => listDriverBehaviour({ from, to }),
  ["gps-monthly-summary-historical-v1"],
  { revalidate: 24 * 60 * 60 },
);

function laoToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });
}

function monthRange(monthISO: string, todayISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = `${monthISO}-01`;
  const naturalEnd = `${monthISO}-${String(lastDay).padStart(2, "0")}`;
  const end = monthISO === todayISO.slice(0, 7) ? todayISO : naturalEnd;
  const days = Math.floor(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  ) + 1;
  return { start, end, days };
}

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split("-").map(Number);
  return `${LAO_MONTHS[month - 1]} ${year}`;
}

function usefulLabel(value: string | null | undefined) {
  const label = value?.trim();
  if (!label) return null;
  if (["ไม่ระบุ", "ບໍ່ລະບຸ", "unspecified", "unknown", "n/a", "-"].includes(label.toLowerCase())) {
    return null;
  }
  return label;
}

function scoreTone(score: number): "green" | "amber" | "red" {
  if (score >= 90) return "green";
  if (score >= 70) return "amber";
  return "red";
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  const styles = {
    teal: "bg-emerald-50 text-emerald-600",
    blue: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="tabular mt-2 text-2xl font-bold tracking-tight text-slate-800">{value}</p>
          <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
        </div>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-base ${styles}`} aria-hidden="true">
          {icon}
        </span>
      </div>
    </div>
  );
}

export default async function GpsMonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const query = await searchParams;
  const today = laoToday();
  const currentMonth = today.slice(0, 7);
  const requestedMonth = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : currentMonth;
  const month = requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const range = monthRange(month, today);

  if (!laoGpsConfigured()) {
    return (
      <>
        <h1 className="mb-5 text-2xl font-semibold">ສະຫຼຸບ GPS ປະຈຳເດືອນ</h1>
        <GpsNotConfigured />
      </>
    );
  }

  const reportPromise = (month === currentMonth ? currentMonthReport : historicalMonthReport)(
    range.start,
    range.end,
  );
  const [vehicles, report] = await Promise.all([
    gpsVehicleOptions(),
    reportPromise.then(
      (rows) => ({ rows, error: null }),
      (cause: unknown) => ({ rows: null, error: laoGpsErrorMessage(cause) }),
    ),
  ]);
  const { rows, error } = report;

  const hrmByImei = new Map(vehicles.map((vehicle) => [vehicle.imei.trim(), vehicle]));
  const reportRows = [...(rows ?? [])].sort((a, b) => b.distance_km - a.distance_km);
  const active = reportRows.filter((row) => row.distance_km >= 1);
  const totalDistance = reportRows.reduce((sum, row) => sum + row.distance_km, 0);
  const totalDriveHours = reportRows.reduce((sum, row) => sum + row.drive_hours, 0);
  const totalFuel = reportRows.reduce((sum, row) => sum + (row.fuel_litre ?? 0), 0);
  const totalOverspeed = reportRows.reduce((sum, row) => sum + row.overspeed_count, 0);
  const averageSafety = reportRows.length
    ? reportRows.reduce((sum, row) => sum + row.safety_score, 0) / reportRows.length
    : 0;
  const activeRate = reportRows.length ? (active.length / reportRows.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#063b3b] to-[#07584f] text-white">
        <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-6">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-100 ring-1 ring-white/10">
              GPS Monthly Summary
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">ສະຫຼຸບ GPS ປະຈຳເດືອນ</h1>
            <p className="mt-1 text-sm text-emerald-50/70">
              ພາບລວມການໃຊ້ລົດ, ໄລຍະທາງ, ຄວາມໄວ, ນ້ຳມັນ ແລະພຶດຕິກຳການຂັບຂີ່
            </p>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl bg-black/15 p-2 ring-1 ring-white/10">
            <label>
              <span className="sr-only">ເດືອນ</span>
              <input
                type="month"
                name="month"
                max={currentMonth}
                defaultValue={month}
                className={`${inputClass} border-white/15 bg-white/10 text-white [color-scheme:dark] focus:border-emerald-300`}
              />
            </label>
            <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
              ສະແດງ
            </button>
          </form>
        </div>
      </section>

      {error && <GpsNotice title="ດຶງຂໍ້ມູນສະຫຼຸບ GPS ບໍ່ໄດ້" detail={error} />}

      {rows && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="ລົດທີ່ໄດ້ແລ່ນ"
              value={`${active.length}/${reportRows.length}`}
              hint={`ມີ GPS ໃນ HRM ${vehicles.length} ຄັນ`}
              icon="▣"
              tone="teal"
            />
            <SummaryCard
              label="ໄລຍະທາງລວມ"
              value={`${num(totalDistance, 0)} ກມ`}
              hint={`${range.start} → ${range.end}`}
              icon="↗"
              tone="blue"
            />
            <SummaryCard
              label="ເວລາແລ່ນລວມ"
              value={hours(totalDriveHours)}
              hint={`${reportRows.reduce((sum, row) => sum + row.trips, 0)} ຖ້ຽວ`}
              icon="◷"
              tone="teal"
            />
            <SummaryCard
              label="ອັດຕາລົດໄດ້ແລ່ນ"
              value={`${num(activeRate, 1)}%`}
              hint={`${active.length} ຄັນຈາກ ${reportRows.length} ຄັນ`}
              icon="⌁"
              tone="amber"
            />
            <SummaryCard
              label="ຂັບເກີນຄວາມໄວ"
              value={`${totalOverspeed} ຄັ້ງ`}
              hint={`ຄະແນນປອດໄພສະເລ່ຍ ${num(averageSafety, 0)}`}
              icon="!"
              tone="rose"
            />
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-bold">ຕາຕະລາງສະຫຼຸບ GPS · {monthLabel(month)}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  ໄລຍະ {range.days} ມື້ · ຈັດລຽງຕາມໄລຍະທາງຫຼາຍຫານ້ອຍ · ນ້ຳມັນທີ່ຄຳນວນໄດ້ລວມ {num(totalFuel, 1)} ລິດ
                </p>
              </div>
              <div className="flex gap-2 text-[11px]">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">ແລ່ນ ≥ 1 ກມ</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">ບໍ່ໄດ້ແລ່ນ</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1720px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <th className="sticky left-0 z-30 w-12 border-b border-r border-border bg-slate-50 px-3 py-3 text-center">#</th>
                    <th className="sticky left-12 z-30 min-w-52 border-b border-r border-border bg-slate-50 px-4 py-3">ລົດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ໄລຍະທາງ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ສະຖານະ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເວລາແລ່ນ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຈອດຕິດເຄື່ອງ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຄວາມໄວສະເລ່ຍ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຄວາມໄວສູງສຸດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ສະເລ່ຍ/ມື້</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ນ້ຳມັນ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ກມ/ລິດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຖ້ຽວ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເກີນຄວາມໄວ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ປອດໄພ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ປະຢັດ</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 && <EmptyRow colSpan={15} text="ບໍ່ມີຂໍ້ມູນ GPS ໃນເດືອນນີ້" />}
                  {reportRows.map((row, index) => {
                    const imei = row.imei.trim();
                    const hrmVehicle = hrmByImei.get(imei);
                    const plate = usefulLabel(hrmVehicle?.plateNo) ?? usefulLabel(row.plate);
                    const name = usefulLabel(hrmVehicle?.name) ?? usefulLabel(row.name);
                    const isActive = row.distance_km >= 1;
                    const stickyBackground = index < 3 && isActive ? "bg-emerald-50" : "bg-card";
                    return (
                      <tr key={row.imei} className={`hover:bg-slate-50 ${index < 3 && isActive ? "bg-emerald-50/30" : ""}`}>
                        <td className={`sticky left-0 z-20 border-b border-r border-border px-3 py-3 text-center tabular text-muted ${stickyBackground}`}>{index + 1}</td>
                        <td className={`sticky left-12 z-20 border-b border-r border-border px-4 py-3 ${stickyBackground}`}>
                          <p className="font-bold text-slate-800">{plate ?? name ?? imei}</p>
                          <p className="mt-0.5 max-w-48 truncate text-[10px] text-muted">{name ?? imei}</p>
                        </td>
                        <td className="border-b border-border px-4 py-3 text-right tabular font-bold text-emerald-600">{num(row.distance_km, 1)} ກມ</td>
                        <td className="border-b border-border px-4 py-3 text-center">
                          <Badge tone={isActive ? "green" : "gray"}>{isActive ? "ໄດ້ແລ່ນ" : "ບໍ່ໄດ້ແລ່ນ"}</Badge>
                        </td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{hours(row.drive_hours)}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{hours(row.idle_hours)}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{num(row.avg_speed_kmh, 1)}</td>
                        <td className={`border-b border-border px-4 py-3 text-right tabular font-semibold ${row.max_speed_kmh >= 80 ? "text-amber-600" : ""}`}>{num(row.max_speed_kmh, 0)}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{num(row.distance_km / range.days, 1)} ກມ</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{row.fuel_litre != null ? `${num(row.fuel_litre, 1)} ລ` : "—"}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{row.km_per_litre != null ? num(row.km_per_litre, 1) : "—"}</td>
                        <td className="border-b border-border px-4 py-3 text-right tabular">{row.trips}</td>
                        <td className={`border-b border-border px-4 py-3 text-right tabular font-semibold ${row.overspeed_count > 0 ? "text-rose-600" : "text-muted"}`}>{row.overspeed_count}</td>
                        <td className="border-b border-border px-4 py-3 text-center"><Badge tone={scoreTone(row.safety_score)}>{num(row.safety_score, 0)}</Badge></td>
                        <td className="border-b border-border px-4 py-3 text-center"><Badge tone={scoreTone(row.eco_score)}>{num(row.eco_score, 0)}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-bold">ຄຳອະທິບາຍ KPI</h3>
              <dl className="mt-3 space-y-3 text-xs">
                <div><dt className="font-semibold">ລົດທີ່ໄດ້ແລ່ນ</dt><dd className="text-muted">ໄລຍະທາງລວມໃນເດືອນຕັ້ງແຕ່ 1 ກມຂຶ້ນໄປ</dd></div>
                <div><dt className="font-semibold">ສະເລ່ຍ/ມື້</dt><dd className="text-muted">ໄລຍະທາງລວມ ÷ ຈຳນວນມື້ໃນຊ່ວງລາຍງານ</dd></div>
                <div><dt className="font-semibold">ຈອດຕິດເຄື່ອງ</dt><dd className="text-muted">ຈອດຢູ່ກັບທີ່ແຕ່ເຄື່ອງຍັງເຮັດວຽກ</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-bold">ນ້ຳມັນ ແລະຄະແນນ</h3>
              <dl className="mt-3 space-y-3 text-xs">
                <div><dt className="font-semibold">ກມ/ລິດ</dt><dd className="text-muted">ຄວາມປະຢັດຈາກໄລຍະທາງ ÷ ນ້ຳມັນທີ່ຄຳນວນໄດ້</dd></div>
                <div><dt className="font-semibold">ຄະແນນປອດໄພ</dt><dd className="text-muted">ພິຈາລະນາການຂັບເກີນຄວາມໄວ ແລະເຫດການຈາກກ້ອງ</dd></div>
                <div><dt className="font-semibold">ຄະແນນປະຢັດ</dt><dd className="text-muted">ພິຈາລະນາການຂັບໄວ ແລະນ້ຳມັນທີ່ເສຍຈາກການຈອດຕິດເຄື່ອງ</dd></div>
              </dl>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
