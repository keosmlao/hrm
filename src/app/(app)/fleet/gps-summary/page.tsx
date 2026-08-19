import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, inputClass } from "@/components/ui";
import {
  laoGpsConfigured,
  laoGpsErrorMessage,
  listDriverBehaviour,
  type LaoGpsDriverBehaviour,
} from "@/lib/laogps";
import { gpsVehicleOptions, hours, num } from "@/lib/fleet-gps";
import { NORM_SOURCE_LABEL, SANE_MAX, SANE_MIN, correctFuel, vehicleFuelNorms, type VehicleFuelNorm } from "@/lib/fuel-quality";
import { GpsNotConfigured, GpsNotice } from "../gps-filter";
import { ReportActions } from "@/components/report-actions";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const LAO_MONTHS = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

/** ຄວາມໄວທີ່ເກີນຄວາມເປັນຈິງ — GPS ກະໂດດ */
const MAX_SPEED_SANE = 140;

/**
 * LaoGPS ຕ້ອງຄຳນວນລາຍງານລົດທຸກຄັນໃນ tracking store ແລະອາດຕອບ
 * HTTP 202 ຫຼາຍຮອບ. ເກັບສະເພາະຜົນທີ່ຄຳນວນສຳເລັດແລ້ວຕາມ from/to,
 * ເພື່ອບໍ່ໃຫ້ຜູ້ໃຊ້ທຸກຄົນລໍຖ້າລາຍງານຊຸດເດີມຊ້ຳໆ.
 */
/**
 * ⏳ ຫຼັງລົ້ມເຫຼວ (202) ຢ່າຍິງຊ້ຳທຸກຄຳຂໍ — ແຕ່ລະຮອບລໍເຖິງ 55 ວິ ແລະ LaoGPS ກໍຍັງຄິດບໍ່ແລ້ວຢູ່ດີ.
 * ພັກ 5 ນາທີ ແລ້ວຈຶ່ງລອງໃໝ່; ລະຫວ່າງນັ້ນໜ້າໃຊ້ຜົນເກົ່າ (lastGoodReport) ທັນທີ.
 */
const FAIL_COOLDOWN_MS = 5 * 60_000;
const failedAt = new Map<string, number>();

async function fetchBehaviour(from: string, to: string, budgetMs?: number) {
  const key = `${from}..${to}`;
  const last = failedAt.get(key);
  if (last && Date.now() - last < FAIL_COOLDOWN_MS) {
    throw new Error("LaoGPS ຍັງຄຳນວນບໍ່ແລ້ວ — ພັກລອງໃໝ່ ~5 ນາທີ");
  }
  try {
    const rows = await listDriverBehaviour({ from, to, budgetMs });
    failedAt.delete(key);
    return rows;
  } catch (e) {
    failedAt.set(key, Date.now());
    throw e;
  }
}

const currentMonthReport = unstable_cache(
  (from: string, to: string) => fetchBehaviour(from, to),
  ["gps-monthly-summary-current-v1"],
  { revalidate: 5 * 60 },
);

const historicalMonthReport = unstable_cache(
  (from: string, to: string) => fetchBehaviour(from, to),
  ["gps-monthly-summary-historical-v1"],
  { revalidate: 24 * 60 * 60 },
);

/** ເດືອນກ່ອນ — ໃຊ້ທຽບເທົ່ານັ້ນ ຈຶ່ງລໍສັ້ນ ແລະ ຖ້າບໍ່ໄດ້ກໍປ່ອຍວ່າງ */
const comparisonReport = unstable_cache(
  (from: string, to: string) => fetchBehaviour(from, to, 12_000),
  ["gps-monthly-summary-compare-v1"],
  { revalidate: 24 * 60 * 60 },
);

/**
 * ຜົນລ່າສຸດທີ່ສຳເລັດ ຕໍ່ຊ່ວງວັນ (ໃນ process ນີ້) — ຖ້າຮອບນີ້ LaoGPS ຍັງຕອບ 202
 * ໃຫ້ສະແດງຂອງເກົ່າພ້ອມປ້າຍ "ຂໍ້ມູນຄ້າງ" ແທນທີ່ຈະຂຶ້ນໜ້າ error ເປົ່າ.
 */
const lastGoodReport = new Map<string, { rows: LaoGpsDriverBehaviour[]; at: number }>();

async function monthReport(from: string, to: string, isCurrentMonth: boolean) {
  const key = `${from}..${to}`;
  try {
    const rows = await (isCurrentMonth ? currentMonthReport : historicalMonthReport)(from, to);
    lastGoodReport.set(key, { rows, at: Date.now() });
    return { rows, error: null as string | null, staleAt: null as number | null };
  } catch (cause) {
    const cached = lastGoodReport.get(key);
    if (cached) return { rows: cached.rows, error: null, staleAt: cached.at };
    return { rows: null, error: laoGpsErrorMessage(cause), staleAt: null };
  }
}

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

/** ເດືອນກ່ອນ ຊ່ວງມື້ເທົ່າກັນ — ທຽບໃຫ້ຍຸດຕິທຳເມື່ອເດືອນນີ້ຍັງບໍ່ຄົບ */
function previousRange(monthISO: string, days: number) {
  const [year, month] = monthISO.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const prevMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    month: prevMonth,
    start: `${prevMonth}-01`,
    end: `${prevMonth}-${String(Math.min(days, lastDay)).padStart(2, "0")}`,
  };
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

/** ສ່ວນຕ່າງກັບເດືອນກ່ອນ ເປັນ % — null ເມື່ອທຽບບໍ່ໄດ້ */
function delta(now: number, before: number | null): number | null {
  if (before == null || before <= 0) return null;
  return ((now - before) / before) * 100;
}

function DeltaLabel({ value, goodWhenDown = false }: { value: number | null; goodWhenDown?: boolean }) {
  if (value == null || !Number.isFinite(value)) return <>ບໍ່ມີຂໍ້ມູນທຽບ</>;
  const up = value >= 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span className={good ? "text-emerald-600" : "text-rose-600"}>
      {up ? "▲" : "▼"} {num(Math.abs(value), 1)}% ທຽບເດືອນກ່ອນ
    </span>
  );
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
  hint: React.ReactNode;
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

function InsightCard({
  title,
  hint,
  tone,
  empty,
  children,
}: {
  title: string;
  hint: string;
  tone: "rose" | "amber" | "slate";
  empty: string;
  children: React.ReactNode[];
}) {
  const bar = { rose: "bg-rose-500", amber: "bg-amber-500", slate: "bg-slate-400" }[tone];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className={`size-2 rounded-full ${bar}`} aria-hidden="true" />
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-[11px] text-muted">{hint}</p>
        </div>
      </div>
      <ul className="divide-y divide-border text-xs">
        {children.length === 0 ? <li className="px-4 py-3 text-muted">{empty}</li> : children}
      </ul>
    </div>
  );
}

type TableRow = {
  rank: number;
  imei: string;
  vehicleId: string | null;
  plate: string;
  name: string;
  department: string | null;
  active: boolean;
  distance: number;
  perDay: number;
  driveHours: number;
  idleHours: number;
  idleFuel: number;
  avgSpeed: number;
  maxSpeed: number;
  fuel: number | null;
  /** ຄ່າດິບຂອງ Lao GPS ກ່ອນແກ້ */
  fuelReported: number | null;
  /** true = ລິດເປັນຄ່າປະມານ ເພາະຄ່າດິບເປັນໄປບໍ່ໄດ້ (ເບິ່ງ lib/fuel-quality.ts) */
  fuelEstimated: boolean;
  fuelNorm: VehicleFuelNorm | null;
  kmPerLitre: number | null;
  trips: number;
  overspeed: number;
  dashcam: number;
  safety: number;
  eco: number;
};

function groupTotals(rows: TableRow[]) {
  const n = Math.max(1, rows.length);
  return {
    distance: rows.reduce((s, r) => s + r.distance, 0),
    drive: rows.reduce((s, r) => s + r.driveHours, 0),
    idle: rows.reduce((s, r) => s + r.idleHours, 0),
    fuel: rows.reduce((s, r) => s + (r.fuel ?? 0), 0),
    trips: rows.reduce((s, r) => s + r.trips, 0),
    overspeed: rows.reduce((s, r) => s + r.overspeed, 0),
    safety: rows.reduce((s, r) => s + r.safety, 0) / n,
    eco: rows.reduce((s, r) => s + r.eco, 0) / n,
    active: rows.filter((r) => r.active).length,
  };
}

/** ແຖວລົດ 1 ຄັນ — ໃຊ້ຮ່ວມທັງແບບລວມ ແລະ ແບບແຍກຕາມພະແນກ */
function SummaryRow({ r, zebra, top = false }: { r: TableRow; zebra: boolean; top?: boolean }) {
  // ⚠ ຖັນ sticky ຕ້ອງເປັນສີ **ທຶບ** — ຖ້າໃສ່ /50 ຕົວເລກຖັນອື່ນຈະລອດຜ່ານມາຕອນເລື່ອນຂວາ
  const sticky = top ? "bg-emerald-50" : zebra ? "bg-slate-50" : "bg-card";
  return (
    <tr className={`hover:bg-slate-50 ${top ? "bg-emerald-50/30" : zebra ? "bg-slate-50/50" : ""}`}>
      <td className={`sticky left-0 z-20 border-b border-r border-border px-3 py-3 text-center tabular text-muted ${sticky}`}>{r.rank}</td>
      <td className={`sticky left-12 z-20 border-b border-r border-border px-4 py-3 ${sticky}`}>
        {r.vehicleId ? (
          <Link href={`/fleet/vehicles/${r.vehicleId}`} className="font-bold text-slate-800 hover:text-primary hover:underline">
            {r.plate}
          </Link>
        ) : (
          <p className="font-bold text-slate-800">{r.plate}</p>
        )}
        <p className="mt-0.5 max-w-48 truncate text-[10px] text-muted">{r.name || r.imei}</p>
      </td>
      <td className="border-b border-border px-4 py-3 text-[11px] text-muted">{r.department ?? "—"}</td>
      <td className="border-b border-border px-4 py-3 text-right tabular font-bold text-emerald-600">{num(r.distance, 1)} ກມ</td>
      <td className="border-b border-border px-4 py-3 text-center">
        <Badge tone={r.active ? "green" : "gray"}>{r.active ? "ໄດ້ແລ່ນ" : "ບໍ່ໄດ້ແລ່ນ"}</Badge>
      </td>
      <td className="border-b border-border px-4 py-3 text-right tabular">{hours(r.driveHours)}</td>
      <td className="border-b border-border px-4 py-3 text-right tabular">{hours(r.idleHours)}</td>
      <td className="border-b border-border px-4 py-3 text-right tabular">{num(r.avgSpeed, 1)}</td>
      <td className={`border-b border-border px-4 py-3 text-right tabular font-semibold ${r.maxSpeed >= 80 ? "text-amber-600" : ""}`}>{num(r.maxSpeed, 0)}</td>
      <td className="border-b border-border px-4 py-3 text-right tabular">{num(r.perDay, 1)} ກມ</td>
      <td className="border-b border-border px-4 py-3 text-right tabular">
        {r.fuel == null ? (
          "—"
        ) : r.fuelEstimated ? (
          <span
            className="text-amber-700"
            title={`ຄ່າດິບ GPS ${num(r.fuelReported ?? 0, 1)} ລ ເປັນໄປບໍ່ໄດ້ — ປະມານຈາກ ${r.fuelNorm ? `${num(r.fuelNorm.kmPerLitre, 1)} ກມ/ລິດ (${NORM_SOURCE_LABEL[r.fuelNorm.source]})` : "ມາດຕະຖານ"}`}
          >
            ≈ {num(r.fuel, 1)} ລ
          </span>
        ) : (
          `${num(r.fuel, 1)} ລ`
        )}
      </td>
      <td className="border-b border-border px-4 py-3 text-right tabular">
        {r.kmPerLitre == null ? "—" : <span className={r.fuelEstimated ? "text-amber-700" : ""}>{num(r.kmPerLitre, 1)}</span>}
      </td>
      <td className="border-b border-border px-4 py-3 text-right tabular">{r.trips}</td>
      <td className={`border-b border-border px-4 py-3 text-right tabular font-semibold ${r.overspeed > 0 ? "text-rose-600" : "text-muted"}`}>{r.overspeed}</td>
      <td className="border-b border-border px-4 py-3 text-right tabular text-muted">{r.dashcam || "—"}</td>
      <td className="border-b border-border px-4 py-3 text-center"><Badge tone={scoreTone(r.safety)}>{num(r.safety, 0)}</Badge></td>
      <td className="border-b border-border px-4 py-3 text-center"><Badge tone={scoreTone(r.eco)}>{num(r.eco, 0)}</Badge></td>
    </tr>
  );
}

export default async function GpsMonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; group?: string; sort?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const query = await searchParams;
  const today = laoToday();
  const currentMonth = today.slice(0, 7);
  const requestedMonth = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : currentMonth;
  const month = requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const range = monthRange(month, today);
  const grouped = query.group === "dept";
  /** ຮຽງແບບ: distance (ຄ່າເລີ່ມຕົ້ນ) ຫຼື safety = ຄະແນນຕ່ຳສຸດກ່ອນ (ແທນໜ້າ "ຄະແນນການຂັບຂີ່" ເກົ່າ) */
  const sort = query.sort === "safety" ? "safety" : "distance";
  const prev = previousRange(month, range.days);
  const printedAt = new Date().toLocaleString("en-GB", { timeZone: "Asia/Vientiane", hour12: false });

  if (!laoGpsConfigured()) {
    return (
      <>
        <h1 className="mb-5 text-2xl font-semibold">ສະຫຼຸບ GPS ປະຈຳເດືອນ</h1>
        <GpsNotConfigured />
      </>
    );
  }

  const [vehicles, vehicleDepts, departments, report, previous, normResult] = await Promise.all([
    gpsVehicleOptions(),
    prisma.carVehicle.findMany({
      where: { gpsImei: { not: null } },
      select: { gpsImei: true, departmentCode: true },
    }),
    prisma.department.findMany({ select: { code: true, nameLo: true } }),
    monthReport(range.start, range.end, month === currentMonth),
    comparisonReport(prev.start, prev.end).catch(() => null),
    vehicleFuelNorms(90),
  ]);
  const { rows, error, staleAt } = report;
  const { norms, fleetKmPerLitre } = normResult;

  const hrmByImei = new Map(vehicles.map((vehicle) => [vehicle.imei.trim(), vehicle]));
  const deptName = new Map(departments.map((d) => [d.code, d.nameLo]));
  const deptByImei = new Map(
    vehicleDepts
      .filter((v) => v.gpsImei?.trim())
      .map((v) => [v.gpsImei!.trim(), (v.departmentCode && deptName.get(v.departmentCode)) || null]),
  );

  const reportRows = [...(rows ?? [])].sort((a, b) =>
    sort === "safety"
      ? a.safety_score - b.safety_score || b.overspeed_count - a.overspeed_count
      : b.distance_km - a.distance_km,
  );
  const table = reportRows.map((row, index) => {
    const imei = row.imei.trim();
    const hrm = hrmByImei.get(imei);
    const fixedFuel = correctFuel(row.distance_km, row.fuel_litre, norms.get(imei));
    const kmPerLitre = fixedFuel.litre && fixedFuel.litre > 0 ? row.distance_km / fixedFuel.litre : null;
    return {
      rank: index + 1,
      imei,
      vehicleId: hrm?.id ?? null,
      plate: usefulLabel(hrm?.plateNo) ?? usefulLabel(row.plate) ?? imei,
      name: usefulLabel(hrm?.name) ?? usefulLabel(row.name) ?? "",
      department: deptByImei.get(imei) ?? null,
      active: row.distance_km >= 1,
      distance: row.distance_km,
      perDay: row.distance_km / range.days,
      driveHours: row.drive_hours,
      idleHours: row.idle_hours,
      idleFuel: row.long_idle_fuel_litre ?? 0,
      avgSpeed: row.avg_speed_kmh,
      maxSpeed: row.max_speed_kmh,
      fuel: fixedFuel.litre,
      fuelReported: fixedFuel.reported,
      fuelEstimated: fixedFuel.estimated,
      fuelNorm: fixedFuel.norm,
      kmPerLitre,
      trips: row.trips,
      overspeed: row.overspeed_count,
      dashcam: row.dashcam_event_count,
      safety: row.safety_score,
      eco: row.eco_score,
    };
  });

  const active = table.filter((r) => r.active);
  const totalDistance = table.reduce((s, r) => s + r.distance, 0);
  const totalDriveHours = table.reduce((s, r) => s + r.driveHours, 0);
  const totalIdleHours = table.reduce((s, r) => s + r.idleHours, 0);
  const totalIdleFuel = table.reduce((s, r) => s + r.idleFuel, 0);
  const totalFuel = table.reduce((s, r) => s + (r.fuel ?? 0), 0);
  const totalOverspeed = table.reduce((s, r) => s + r.overspeed, 0);
  const totalTrips = table.reduce((s, r) => s + r.trips, 0);
  const averageSafety = table.length ? table.reduce((s, r) => s + r.safety, 0) / table.length : 0;
  const activeRate = table.length ? (active.length / table.length) * 100 : 0;

  // ແຍກຕາມພະແນກ (ພະແນກທີ່ແລ່ນຫຼາຍກ່ອນ) — ໃຊ້ເມື່ອ ?group=dept
  const deptGroups = [...new Map<string, TableRow[]>(
    table.map((r) => [r.department ?? "ບໍ່ໄດ້ລະບຸພະແນກ", [] as TableRow[]]),
  )]
    .map(([label]) => {
      const rows = table.filter((r) => (r.department ?? "ບໍ່ໄດ້ລະບຸພະແນກ") === label);
      return { label, rows, totals: groupTotals(rows) };
    })
    .sort((a, b) => b.totals.distance - a.totals.distance);

  // ເດືອນກ່ອນ (ຊ່ວງມື້ເທົ່າກັນ) — ໃຊ້ພຽງຍອດລວມມາທຽບ
  const prevDistance = previous?.reduce((s, r) => s + r.distance_km, 0) ?? null;
  const prevFuel = previous?.reduce((s, r) => s + (r.fuel_litre ?? 0), 0) ?? null;
  const prevOverspeed = previous?.reduce((s, r) => s + r.overspeed_count, 0) ?? null;

  // ຈຸດທີ່ຄວນເບິ່ງ
  const watchlist = table
    .filter((r) => r.active && (r.safety < 70 || r.overspeed > 0))
    .sort((a, b) => a.safety - b.safety || b.overspeed - a.overspeed)
    .slice(0, 5);
  const idleVehicles = table
    .filter((r) => !r.active)
    .concat(table.filter((r) => r.active && r.perDay < 5))
    .slice(0, 5);
  const corrected = table.filter((r) => r.fuelEstimated);
  const dataIssues = table
    .filter((r) => r.fuelEstimated || r.maxSpeed > MAX_SPEED_SANE || (r.active && r.fuel == null))
    .slice(0, 5);

  const csvHeaders = [
    "ອັນດັບ", "ລົດ", "ຍີ່ຫໍ້", "ພະແນກ", "ໄລຍະທາງ_ກມ", "ສະເລ່ຍຕໍ່ມື້_ກມ", "ເວລາແລ່ນ_ຊມ",
    "ຈອດຕິດເຄື່ອງ_ຊມ", "ຄວາມໄວສະເລ່ຍ", "ຄວາມໄວສູງສຸດ", "ນ້ຳມັນ_ລິດ", "ກມຕໍ່ລິດ",
    "ຖ້ຽວ", "ເກີນຄວາມໄວ_ຄັ້ງ", "ກ້ອງແຈ້ງ_ຄັ້ງ", "ຄະແນນປອດໄພ", "ຄະແນນປະຢັດ",
  ];
  const csvRows = table.map((r) => [
    r.rank, r.plate, r.name, r.department ?? "", r.distance.toFixed(1), r.perDay.toFixed(1),
    r.driveHours.toFixed(1), r.idleHours.toFixed(1), r.avgSpeed.toFixed(1), r.maxSpeed.toFixed(0),
    r.fuel != null ? r.fuel.toFixed(1) : "", r.kmPerLitre != null ? r.kmPerLitre.toFixed(1) : "",
    r.trips, r.overspeed, r.dashcam, r.safety.toFixed(0), r.eco.toFixed(0),
  ]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#063b3b] to-[#07584f] text-white print:bg-white print:text-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-6">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-100 ring-1 ring-white/10 print:hidden">
              GPS Monthly Summary
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">ສະຫຼຸບ GPS ປະຈຳເດືອນ · {monthLabel(month)}</h1>
            <p className="mt-1 text-sm text-emerald-50/70 print:text-slate-600">
              ພາບລວມການໃຊ້ລົດ, ໄລຍະທາງ, ຄວາມໄວ, ນ້ຳມັນ ແລະພຶດຕິກຳການຂັບຂີ່
            </p>
            <p className="tabular mt-3 text-[11px] text-emerald-50/60 print:text-slate-500">
              ຊ່ວງລາຍງານ {range.start} → {range.end} ({range.days} ມື້) · ລົດ {table.length} ຄັນ · ອອກລາຍງານ {printedAt}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <ReportActions filename={`gps-summary-${month}`} headers={csvHeaders} rows={csvRows} />
            <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl bg-black/15 p-2 ring-1 ring-white/10 print:hidden">
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
        </div>
      </section>

      {error && <GpsNotice title="ດຶງຂໍ້ມູນສະຫຼຸບ GPS ບໍ່ໄດ້" detail={error} />}

      {staleAt != null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          LaoGPS ຍັງຄຳນວນລາຍງານເດືອນນີ້ບໍ່ແລ້ວ — ກຳລັງສະແດງຜົນຄັ້ງລ່າສຸດ (ດຶງເມື່ອ{" "}
          {new Date(staleAt).toLocaleString("en-GB", { timeZone: "Asia/Vientiane", hour12: false })}) · ໂຫຼດໜ້ານີ້ໃໝ່ອີກໜ້ອຍໜຶ່ງ
        </div>
      )}

      {rows && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <SummaryCard
              label="ລົດທີ່ໄດ້ແລ່ນ"
              value={`${active.length}/${table.length}`}
              hint={`ໃຊ້ງານ ${num(activeRate, 1)}% · ມີ GPS ໃນ HRM ${vehicles.length} ຄັນ`}
              icon="▣"
              tone="teal"
            />
            <SummaryCard
              label="ໄລຍະທາງລວມ"
              value={`${num(totalDistance, 0)} ກມ`}
              hint={<DeltaLabel value={delta(totalDistance, prevDistance)} />}
              icon="↗"
              tone="blue"
            />
            <SummaryCard
              label="ເວລາແລ່ນລວມ"
              value={hours(totalDriveHours)}
              hint={`${totalTrips.toLocaleString()} ຖ້ຽວ · ສະເລ່ຍ ${num(totalDistance / Math.max(1, totalTrips), 1)} ກມ/ຖ້ຽວ`}
              icon="◷"
              tone="teal"
            />
            <SummaryCard
              label="ນ້ຳມັນທີ່ຄຳນວນໄດ້"
              value={`${num(totalFuel, 0)} ລ`}
              hint={<DeltaLabel value={delta(totalFuel, prevFuel)} goodWhenDown />}
              icon="⛽"
              tone="amber"
            />
            <SummaryCard
              label="ຈອດຕິດເຄື່ອງ"
              value={hours(totalIdleHours)}
              hint={`ນ້ຳມັນເສຍປະມານ ${num(totalIdleFuel, 0)} ລິດ`}
              icon="⏻"
              tone="amber"
            />
            <SummaryCard
              label="ຂັບເກີນຄວາມໄວ"
              value={`${totalOverspeed} ຄັ້ງ`}
              hint={
                <>
                  ຄະແນນປອດໄພສະເລ່ຍ {num(averageSafety, 0)} · <DeltaLabel value={delta(totalOverspeed, prevOverspeed)} goodWhenDown />
                </>
              }
              icon="!"
              tone="rose"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <InsightCard
              title="ຄວນກວດພຶດຕິກຳການຂັບ"
              hint="ຄະແນນປອດໄພຕ່ຳ ຫຼື ຂັບເກີນຄວາມໄວ"
              tone="rose"
              empty="ບໍ່ມີຄັນໃດຕ້ອງກວດ — ດີຫຼາຍ"
            >
              {watchlist.map((r) => (
                <li key={r.imei} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.plate}</span>
                    <span className="block text-[11px] text-muted">
                      ສູງສຸດ {num(r.maxSpeed, 0)} ກມ/ຊມ{r.dashcam > 0 ? ` · ກ້ອງ ${r.dashcam} ເຫດການ` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-rose-600">{r.overspeed} ຄັ້ງ</span>
                    <span className="block text-[11px] text-muted">ປອດໄພ {num(r.safety, 0)}</span>
                  </span>
                </li>
              ))}
            </InsightCard>

            <InsightCard
              title="ລົດຖືກໃຊ້ໜ້ອຍ"
              hint="ບໍ່ໄດ້ແລ່ນ ຫຼື ສະເລ່ຍ < 5 ກມ/ມື້"
              tone="slate"
              empty="ລົດທຸກຄັນຖືກໃຊ້ຕາມປົກກະຕິ"
            >
              {idleVehicles.map((r) => (
                <li key={r.imei} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.plate}</span>
                    <span className="block text-[11px] text-muted">{r.department ?? "ບໍ່ໄດ້ລະບຸພະແນກ"}</span>
                  </span>
                  <span className="tabular shrink-0 text-right text-muted">{num(r.distance, 1)} ກມ</span>
                </li>
              ))}
            </InsightCard>

            <InsightCard
              title="ຂໍ້ມູນໜ້າສົງໄສ"
              hint="ຄ່າທີ່ບໍ່ໜ້າຈະເປັນໄປໄດ້ — ແກ້ດ້ວຍມາດຕະຖານແລ້ວ ແຕ່ຄວນກວດເຊັນເຊີ"
              tone="amber"
              empty="ບໍ່ພົບຄ່າຜິດປົກກະຕິ"
            >
              {dataIssues.map((r) => (
                <li key={r.imei} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.plate}</span>
                    <span className="block text-[11px] text-muted">
                      {r.fuelEstimated
                        ? `ນ້ຳມັນດິບ ${num(r.fuelReported ?? 0, 0)} ລ → ປະມານ ${num(r.fuel ?? 0, 0)} ລ`
                        : r.maxSpeed > MAX_SPEED_SANE
                          ? `ຄວາມໄວສູງສຸດ ${num(r.maxSpeed, 0)} ກມ/ຊມ`
                          : "ວັດນ້ຳມັນບໍ່ໄດ້"}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-right text-muted">{num(r.distance, 0)} ກມ</span>
                </li>
              ))}
            </InsightCard>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-bold">ຕາຕະລາງສະຫຼຸບ GPS · {monthLabel(month)}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  ໄລຍະ {range.days} ມື້ · {grouped ? "ແຍກຕາມພະແນກ (ພະແນກທີ່ແລ່ນຫຼາຍກ່ອນ)" : sort === "safety" ? "ຮຽງຕາມຄະແນນປອດໄພ ຕ່ຳສຸດກ່ອນ" : "ຈັດລຽງຕາມໄລຍະທາງຫຼາຍຫານ້ອຍ"} · ນ້ຳມັນລວມ {num(totalFuel, 1)} ລິດ{corrected.length > 0 && ` (ແກ້ຄ່າ ${corrected.length} ຄັນ)`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] print:hidden">
                <Link
                  href={`/fleet/gps-summary?month=${month}${sort === "safety" ? "&sort=safety" : ""}`}
                  className={`rounded-full px-3 py-1 font-medium ${grouped ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-slate-800 text-white"}`}
                >
                  ລວມທັງໝົດ
                </Link>
                <Link
                  href={`/fleet/gps-summary?month=${month}&group=dept${sort === "safety" ? "&sort=safety" : ""}`}
                  className={`rounded-full px-3 py-1 font-medium ${grouped ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  ແຍກຕາມພະແນກ
                </Link>
                <Link
                  href={`/fleet/gps-summary?month=${month}${grouped ? "&group=dept" : ""}&sort=safety`}
                  className={`rounded-full px-3 py-1 font-medium ${sort === "safety" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}
                  title="ຮຽງຄະແນນປອດໄພຕ່ຳສຸດກ່ອນ (ແທນໜ້າ ຄະແນນການຂັບຂີ່ ເກົ່າ)"
                >
                  ຮຽງຕາມຄະແນນ
                </Link>
                <span className="ml-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">ແລ່ນ ≥ 1 ກມ</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">ບໍ່ໄດ້ແລ່ນ</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">≈ ນ້ຳມັນປະມານ</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1820px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <th className="sticky left-0 z-30 w-12 border-b border-r border-border bg-slate-50 px-3 py-3 text-center">#</th>
                    <th className="sticky left-12 z-30 min-w-52 border-b border-r border-border bg-slate-50 px-4 py-3">ລົດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3">ພະແນກ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ໄລຍະທາງ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ສະຖານະ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເວລາແລ່ນ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຈອດຕິດເຄື່ອງ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຄວາມໄວສະເລ່ຍ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ຄວາມໄວສູງສຸດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ສະເລ່ຍ/ມື້</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ນ້ຳມັນ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ກມ/ລິດ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right" title="ຈຳນວນຄັ້ງທີ່ລົດອອກແລ່ນແລ້ວຈອດ (ຈາກ GPS) — ບໍ່ແມ່ນ trip ທີ່ຈອງໃນ HRM">ຖ້ຽວ (GPS)</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right">ເກີນຄວາມໄວ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-right" title="ເຫດການທີ່ກ້ອງ ADAS/DMS ແຈ້ງເຕືອນ">ກ້ອງແຈ້ງ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ປອດໄພ</th>
                    <th className="border-b border-border bg-slate-50 px-4 py-3 text-center">ປະຢັດ</th>
                  </tr>
                </thead>
                {grouped ? (
                  deptGroups.map((g) => (
                    <tbody key={g.label}>
                      <tr>
                        <td colSpan={17} className="border-b border-border bg-slate-800 px-4 py-2 text-[11px] font-bold text-white">
                          {g.label} · {g.rows.length} ຄັນ · {num(g.totals.distance, 0)} ກມ
                          {g.totals.fuel > 0 && ` · ${num(g.totals.fuel, 0)} ລ`}
                          {g.totals.overspeed > 0 && ` · ເກີນຄວາມໄວ ${g.totals.overspeed} ຄັ້ງ`}
                        </td>
                      </tr>
                      {g.rows.map((r, i) => <SummaryRow key={r.imei} r={r} zebra={i % 2 === 1} />)}
                      <tr className="bg-slate-100 font-semibold">
                        <td className="sticky left-0 z-20 border-b border-r border-border bg-slate-100 px-3 py-2" />
                        <td className="sticky left-12 z-20 border-b border-r border-border bg-slate-100 px-4 py-2">ລວມ {g.label}</td>
                        <td className="border-b border-border px-4 py-2" />
                        <td className="border-b border-border px-4 py-2 text-right tabular">{num(g.totals.distance, 0)} ກມ</td>
                        <td className="border-b border-border px-4 py-2 text-center text-[11px] text-muted">{g.totals.active}/{g.rows.length} ໄດ້ແລ່ນ</td>
                        <td className="border-b border-border px-4 py-2 text-right tabular">{hours(g.totals.drive)}</td>
                        <td className="border-b border-border px-4 py-2 text-right tabular">{hours(g.totals.idle)}</td>
                        <td className="border-b border-border px-4 py-2" />
                        <td className="border-b border-border px-4 py-2" />
                        <td className="border-b border-border px-4 py-2 text-right tabular">{num(g.totals.distance / range.days, 1)} ກມ</td>
                        <td className="border-b border-border px-4 py-2 text-right tabular">{g.totals.fuel > 0 ? `${num(g.totals.fuel, 0)} ລ` : "—"}</td>
                        <td className="border-b border-border px-4 py-2 text-right tabular">{g.totals.fuel > 0 ? num(g.totals.distance / g.totals.fuel, 1) : "—"}</td>
                        <td className="border-b border-border px-4 py-2 text-right tabular">{g.totals.trips}</td>
                        <td className="border-b border-border px-4 py-2 text-right tabular text-rose-600">{g.totals.overspeed}</td>
                        <td className="border-b border-border px-4 py-2" />
                        <td className="border-b border-border px-4 py-2 text-center tabular">{num(g.totals.safety, 0)}</td>
                        <td className="border-b border-border px-4 py-2 text-center tabular">{num(g.totals.eco, 0)}</td>
                      </tr>
                    </tbody>
                  ))
                ) : (
                  <tbody>
                    {table.length === 0 && <EmptyRow colSpan={17} text="ບໍ່ມີຂໍ້ມູນ GPS ໃນເດືອນນີ້" />}
                    {table.map((r) => <SummaryRow key={r.imei} r={r} zebra={r.rank % 2 === 0} top={r.rank <= 3 && r.active} />)}
                  </tbody>
                )}
                {table.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td className="sticky left-0 z-20 border-t border-r border-border bg-slate-100 px-3 py-3" />
                      <td className="sticky left-12 z-20 border-t border-r border-border bg-slate-100 px-4 py-3">ລວມ {table.length} ຄັນ</td>
                      <td className="border-t border-border px-4 py-3" />
                      <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalDistance, 0)} ກມ</td>
                      <td className="border-t border-border px-4 py-3 text-center text-[11px] font-medium text-muted">{active.length} ໄດ້ແລ່ນ</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{hours(totalDriveHours)}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{hours(totalIdleHours)}</td>
                      <td className="border-t border-border px-4 py-3" />
                      <td className="border-t border-border px-4 py-3" />
                      <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalDistance / range.days, 1)} ກມ</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{num(totalFuel, 0)} ລ</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">
                        {totalFuel > 0 ? num(totalDistance / totalFuel, 1) : "—"}
                      </td>
                      <td className="border-t border-border px-4 py-3 text-right tabular">{totalTrips}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular text-rose-600">{totalOverspeed}</td>
                      <td className="border-t border-border px-4 py-3 text-right tabular text-muted">{table.reduce((s, r) => s + r.dashcam, 0) || "—"}</td>
                      <td className="border-t border-border px-4 py-3 text-center tabular">{num(averageSafety, 0)}</td>
                      <td className="border-t border-border px-4 py-3 text-center tabular">
                        {num(table.reduce((s, r) => s + r.eco, 0) / Math.max(1, table.length), 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-bold">ຄຳອະທິບາຍ KPI</h3>
              <dl className="mt-3 space-y-3 text-xs">
                <div><dt className="font-semibold">ລົດທີ່ໄດ້ແລ່ນ</dt><dd className="text-muted">ໄລຍະທາງລວມໃນເດືອນຕັ້ງແຕ່ 1 ກມຂຶ້ນໄປ</dd></div>
                <div><dt className="font-semibold">ສະເລ່ຍ/ມື້</dt><dd className="text-muted">ໄລຍະທາງລວມ ÷ ຈຳນວນມື້ໃນຊ່ວງລາຍງານ</dd></div>
                <div><dt className="font-semibold">ຖ້ຽວ (GPS)</dt><dd className="text-muted">ຈຳນວນຄັ້ງທີ່ລົດອອກແລ່ນແລ້ວຈອດ ນັບໂດຍ GPS — ບໍ່ແມ່ນ trip ທີ່ຈອງໃນ HRM (ໄປ-ກັບ 1 ຮອບ ອາດນັບໄດ້ຫຼາຍຖ້ຽວ ຖ້າຈອດແວ່ຫຼາຍບ່ອນ)</dd></div>
                <div><dt className="font-semibold">ຈອດຕິດເຄື່ອງ</dt><dd className="text-muted">ຈອດຢູ່ກັບທີ່ແຕ່ເຄື່ອງຍັງເຮັດວຽກ — ນ້ຳມັນເສຍຄິດຈາກຊ່ວງຈອດດົນ</dd></div>
                <div><dt className="font-semibold">ທຽບເດືອນກ່ອນ</dt><dd className="text-muted">ທຽບກັບຊ່ວງມື້ເທົ່າກັນຂອງເດືອນກ່ອນ ({prev.start} → {prev.end})</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-bold">ນ້ຳມັນ ແລະຄະແນນ</h3>
              <dl className="mt-3 space-y-3 text-xs">
                <div><dt className="font-semibold">ກມ/ລິດ</dt><dd className="text-muted">ຄວາມປະຢັດຈາກໄລຍະທາງ ÷ ນ້ຳມັນ · ຄັນທີ່ຄ່າດິບຢູ່ນອກ {SANE_MIN}–{SANE_MAX} ກມ/ລິດ ຖືກແກ້ດ້ວຍມາດຕະຖານ ແລະ ໝາຍ ≈ ໄວ້ (ຄ່າກາງ fleet {num(fleetKmPerLitre ?? 0, 1)})</dd></div>
                <div><dt className="font-semibold">ຄະແນນປອດໄພ</dt><dd className="text-muted">ພິຈາລະນາການຂັບເກີນຄວາມໄວ ແລະເຫດການຈາກກ້ອງ (ຂຽວ ≥90 · ເຫຼືອງ 70–89 · ແດງ &lt;70)</dd></div>
                <div><dt className="font-semibold">ຄະແນນປະຢັດ</dt><dd className="text-muted">ພິຈາລະນາການຂັບໄວ ແລະນ້ຳມັນທີ່ເສຍຈາກການຈອດຕິດເຄື່ອງ</dd></div>
                <div><dt className="font-semibold">ໝາຍເຫດ</dt><dd className="text-muted">ຄະແນນຄິດ <b>ຕໍ່ລົດ</b> ບໍ່ແມ່ນຕໍ່ຄົນຂັບ — ຢາກຮູ້ຜູ້ຂັບ ໃຫ້ອີງ trip ຂອງ HRM</dd></div>
              </dl>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
