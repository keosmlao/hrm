"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeCode: string;
    fullnameLo: string;
    positionCode: string;
    departmentCode: string;
    unitCode: string;
    divisionCode: string;
    hireDate: string | null;
    employmentStatus: string | null;
    titleLo: string | null;
    titleEn: string | null;
    fullnameEn: string | null;
  } | null;
}

interface EmpData {
  title_lo: string | null;
  fullname_lo: string | null;
  title_en: string | null;
  fullname_en: string | null;
  employee_code: string;
  employment_status: string | null;
  hire_date: string | null;
  position_name_lo: string | null;
  unit_name_lo: string | null;
  department_name_lo: string | null;
  division_name_lo: string | null;
}

type IconProps = { className?: string };

interface QuickActionItem {
  href: string;
  title: string;
  description: string;
  Icon: (props: IconProps) => ReactNode;
  gradient: string;
  iconBg: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  { href: "/training-need", title: "ຄວາມຕ້ອງການຝຶກອົບຮົມ", description: "ສົ່ງຄຳຂໍຝຶກອົບຮົມ ແລະ ຕິດຕາມສະຖານະ", Icon: BookIcon, gradient: "from-[#2F65AB] to-[#1a4a8a]", iconBg: "bg-[#2F65AB]/10 text-[#2F65AB]" },
  { href: "/org-chart", title: "ໂຄງສ້າງອົງກອນ", description: "ເບິ່ງຜັງອົງກອນ ແລະ ສາຍງານ", Icon: OrgChartIcon, gradient: "from-[#4a8ad4] to-[#2F65AB]", iconBg: "bg-[#4a8ad4]/10 text-[#3a75bb]" },
  { href: "/performance-evaluation", title: "ປະເມີນຜົນງານ OD 2026", description: "ຈັດການແບບປະເມີນ OD 2026", Icon: ClipboardCheckIcon, gradient: "from-[#2F65AB] to-[#1a4a8a]", iconBg: "bg-violet-500/10 text-violet-600" },
  { href: "/staff-evaluation", title: "ປະເມີນຜົນງານ", description: "ປະເມີນຕົນເອງ ແລະ ປະເມີນລູກທີມ", Icon: UserCheckIcon, gradient: "from-[#2F65AB] to-[#1a4a8a]", iconBg: "bg-[#2F65AB]/10 text-[#2F65AB]" },
  { href: "/staff-eval-assign", title: "ຕັ້ງຄ່າຜູ້ຖືກປະເມີນ", description: "ເພີ່ມຄົນເຂົ້າລາຍການປະເມີນ", Icon: UserPlusIcon, gradient: "from-[#4a8ad4] to-[#2F65AB]", iconBg: "bg-rose-500/10 text-rose-500" },
  { href: "/crs", title: "ລົງທະບຽນ CRS", description: "ກຳນົດຫົວຂໍ້ ແລະ ລົງທະບຽນໃນລະບົບ", Icon: CalendarPlusIcon, gradient: "from-[#2F65AB] to-[#1a4a8a]", iconBg: "bg-amber-500/10 text-amber-600" },
  { href: "/meetings", title: "ນັດປະຊຸມ", description: "ສ້າງ ແລະ ຈັດການການນັດປະຊຸມ", Icon: MeetingIcon, gradient: "from-[#4a8ad4] to-[#2F65AB]", iconBg: "bg-[#2F65AB]/10 text-[#2F65AB]" },
  { href: "/settings", title: "ຕັ້ງຄ່າ", description: "ກຳນົດຜູ້ຈັດຕາຕະລາງປະຊຸມ (IT)", Icon: SettingsIcon, gradient: "from-[#2F65AB] to-[#1a4a8a]", iconBg: "bg-slate-500/10 text-slate-500" },
];

const AURORA_NOISE_DATA_URL =
  "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "ສະບາຍດີຕອນເຊົ້າ";
  if (hour < 17) return "ສະບາຍດີຕອນບ່າຍ";
  return "ສະບາຍດີຕອນແລງ";
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [emp, setEmp] = useState<EmpData | null>(null);
  const [myMeetings, setMyMeetings] = useState<MeetingItem[]>([]);

  useEffect(() => {
    apiFetch<{ session: SessionData; emp: EmpData | null }>("/page-data/home")
      .then((data) => { setSession(data.session); setEmp(data.emp); })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));

    // Fetch meetings (silently — don't block page load)
    apiFetch<{ meetings: Array<{ id: number; title: string; meetingDate: string | null; startTime: string | null; endTime: string | null; location: string | null; participantCount: number; isViewerParticipant?: boolean; myResponseStatus?: string | null; isJoined?: boolean; isOwner?: boolean }> }>("/page-data/meetings")
      .then((data) => {
        // Show all meetings the user can see (participant or organizer/owner)
        const visible = data.meetings.filter((m) => m.isViewerParticipant || m.isOwner || m.isJoined);
        console.log("[Home] meetings loaded:", data.meetings.length, "visible:", visible.length);
        setMyMeetings(visible);
      })
      .catch((e) => { console.error("[Home] meetings fetch failed:", e); });
  }, [router]);

  if (loading) return <LoadingScreen />;
  if (!session) return null;

  const displayName = emp?.fullname_lo || session.lineDisplayName || "User";
  const englishName = [emp?.title_en, emp?.fullname_en].filter(Boolean).join(" ");
  const employmentStatus = formatEmploymentStatus(emp?.employment_status);
  const employmentTone = getStatusTone(emp?.employment_status);
  const workAge = emp?.hire_date ? calcWorkAge(emp.hire_date) : "-";
  const joinedOn = formatDate(emp?.hire_date);
  const positionName = getDisplayValue(emp?.position_name_lo);
  const unitName = getDisplayValue(emp?.unit_name_lo);
  const departmentName = getDisplayValue(emp?.department_name_lo);
  const affiliationLabel = unitName || departmentName || null;

  return (
    <div className="aurora-page min-h-screen text-slate-900">
      <AuroraBackground />

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        {emp ? (
          <div className="space-y-6">
            {/* Welcome + Profile */}
            <section className="overflow-hidden rounded-3xl border border-white/60 bg-white/65 shadow-lg shadow-black/[0.04] backdrop-blur-xl">
              {/* Gradient banner */}
              <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#1a3a6a] via-[#2F65AB] to-[#4a8ad4] sm:h-36">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#6aa3e0]/20 blur-3xl" />
                  <div className="absolute -bottom-10 left-1/4 h-32 w-56 rounded-full bg-[#2F65AB]/15 blur-3xl" />
                  <div className="absolute right-1/3 top-1/4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                </div>
                <div className="relative flex h-full flex-col justify-end px-5 pb-12 sm:px-7">
                  <p className="text-xs font-medium text-white/50">{getGreeting()}</p>
                  <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                    {emp.title_lo ? `${emp.title_lo} ` : ""}{emp.fullname_lo || displayName}
                  </h2>
                </div>
              </div>

              {/* Profile info */}
              <div className="relative px-5 pb-5 sm:px-7 sm:pb-6">
                {/* Avatar - overlapping banner */}
                <div className="-mt-8 flex items-end justify-between gap-4">
                  <Avatar
                    src={session.linePictureUrl}
                    name={displayName}
                    className="h-16 w-16 text-xl ring-[3px] ring-white shadow-lg sm:h-[4.5rem] sm:w-[4.5rem]"
                  />
                  <StatusBadge label={employmentStatus} tone={employmentTone} />
                </div>

                {/* Name + meta */}
                <div className="mt-3">
                  {englishName && (
                    <p className="text-sm text-slate-400">{englishName}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {positionName && <Chip>{positionName}</Chip>}
                    {affiliationLabel && <Chip variant="outline">{affiliationLabel}</Chip>}
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <InfoCell label="ລະຫັດ" value={emp.employee_code || "-"} />
                  <InfoCell label="ອາຍຸງານ" value={workAge} />
                  <InfoCell label="ເຂົ້າວຽກ" value={joinedOn} />
                  <InfoCell label="LINE" value={session.lineDisplayName || "-"} />
                </div>
              </div>
            </section>

            {/* Monthly Calendar */}
            <MonthlyCalendar meetings={myMeetings} />

            {/* Quick Actions */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">ເມນູດ່ວນ</h3>
                <p className="text-xs text-slate-400">ເຂົ້າເຖິງ workflow ທີ່ໃຊ້ບ່ອຍ</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {QUICK_ACTIONS.map((a) => (
                  <QuickActionCard key={a.href} action={a} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* Unlinked account state */
          <div className="space-y-5">
            <section className="overflow-hidden rounded-3xl border border-white/60 bg-white/65 shadow-lg shadow-black/[0.04] backdrop-blur-xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-rose-500 px-5 py-6 sm:px-7">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                  <div className="absolute -bottom-6 left-10 h-28 w-28 rounded-full bg-yellow-200/15 blur-2xl" />
                </div>
                <div className="relative">
                  <p className="text-xs font-medium text-white/60">Account Status</p>
                  <h2 className="mt-1 text-xl font-bold text-white">ບັນຊີຍັງບໍ່ໄດ້ເຊື່ອມຂໍ້ມູນ</h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
                    ບັນຊີ LINE ນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile. ກະລຸນາຕິດຕໍ່ HR.
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={session.linePictureUrl}
                    name={session.lineDisplayName || "?"}
                    className="h-14 w-14 text-lg ring-2 ring-slate-100 shadow-md"
                  />
                  <div>
                    <p className="text-xs text-slate-400">LINE account</p>
                    <p className="text-lg font-bold text-slate-800">{session.lineDisplayName || "-"}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-400">LINE User ID</p>
                  <p className="mt-1 break-all text-sm font-mono text-slate-700">{session.lineUserId}</p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-sm leading-relaxed text-amber-800">
                  ກະລຸນາສົ່ງ LINE User ID ໃຫ້ HR ຫຼື admin ເພື່ອກວດສອບ ແລ້ວຈຶ່ງເຂົ້າລະບົບໃໝ່.
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/65 p-5 shadow-lg shadow-black/[0.04] backdrop-blur-xl sm:p-6">
              <h3 className="text-base font-bold text-slate-800">ຂັ້ນຕອນຕໍ່ໄປ</h3>
              <p className="mt-1 text-sm text-slate-400">ເມື່ອຈັບຄູ່ສຳເລັດ profile ຈະປາກົດໃນຫນ້ານີ້</p>
              <div className="mt-5 space-y-3">
                <StepItem number="1" text="ສົ່ງ LINE User ID ໃຫ້ HR ຫຼື admin" />
                <StepItem number="2" text="ລໍຖ້າການກວດສອບ ແລະ ຈັບຄູ່ຂໍ້ມູນ" />
                <StepItem number="3" text="ອອກຈາກລະບົບ ແລະ ເຂົ້າໃໝ່" />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

/* ===== Shared Components ===== */

export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#edf0f7]">
      <div className="aurora-blob-1 absolute -left-[18%] -top-[14%] h-[760px] w-[760px] rounded-full bg-[radial-gradient(circle,rgba(47,101,171,0.12)_0%,rgba(47,101,171,0.03)_42%,transparent_72%)]" />
      <div className="aurora-blob-2 absolute right-[-12%] top-[3%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(47,101,171,0.18)_0%,rgba(47,101,171,0.04)_48%,transparent_72%)]" />
      <div className="aurora-blob-3 absolute bottom-[-6%] left-[14%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(99,148,210,0.16)_0%,rgba(99,148,210,0.03)_50%,transparent_74%)]" />
      <div className="aurora-blob-4 absolute bottom-[-18%] right-[5%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(30,80,140,0.14)_0%,rgba(30,80,140,0.03)_50%,transparent_74%)]" />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage: `url("${AURORA_NOISE_DATA_URL}")` }}
      />
    </div>
  );
}

export function AuroraBrandMark() {
  return (
    <div aria-hidden="true" className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[1rem] bg-[linear-gradient(145deg,#06100b_0%,#0a4327_58%,#06c755_100%)] shadow-[0_12px_28px_-14px_rgba(6,199,85,0.75)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_32%)]" />
      <div className="relative flex flex-col items-center">
        <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-white">ODG</span>
        <span className="text-[0.36rem] font-bold uppercase tracking-[0.2em] text-white/70">AI HRM</span>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#edf0f7]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2F65AB]/20 border-t-[#2F65AB]" />
        <p className="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>
      </div>
    </div>
  );
}

/* ===== Helper functions ===== */

function getDisplayValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function calcWorkAge(hireDate: string | Date): string {
  const hire = new Date(hireDate);
  if (Number.isNaN(hire.getTime())) return "-";
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  let days = now.getDate() - hire.getDate();
  if (days < 0) { months--; const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); days += prevMonth.getDate(); }
  if (months < 0) { years--; months += 12; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ປີ`);
  if (months > 0) parts.push(`${months} ເດືອນ`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ມື້`);
  return parts.join(" ");
}

function formatEmploymentStatus(status: string | null | undefined): string {
  switch (status?.toUpperCase()) {
    case "ACTIVE": return "ກຳລັງໃຊ້ງານ";
    case "INACTIVE": return "ບໍ່ໄດ້ໃຊ້ງານ";
    default: return status ? status.replaceAll("_", " ") : "-";
  }
}

function getStatusTone(status: string | null | undefined) {
  switch (status?.toUpperCase()) {
    case "ACTIVE": return "success" as const;
    case "INACTIVE": return "neutral" as const;
    default: return "warning" as const;
  }
}

/* ===== UI Components ===== */

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }
function getInitial(value: string): string { return value.trim().charAt(0).toUpperCase() || "?"; }

function Avatar({ src, name, className }: { src: string | null; name: string; className: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className={cn(className, "rounded-2xl bg-white object-cover")} />
  ) : (
    <div className={cn(className, "flex items-center justify-center rounded-2xl bg-[#2F65AB] font-bold text-white")}>{getInitial(name)}</div>
  );
}

function Chip({ children, variant = "filled" }: { children: ReactNode; variant?: "filled" | "outline" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium",
        variant === "filled"
          ? "bg-[#2F65AB] text-white"
          : "border border-slate-200 bg-white/80 text-slate-600"
      )}
    >
      {children}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50/80 px-3.5 py-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "neutral" }) {
  const cls =
    tone === "success"
      ? "bg-[#2F65AB]/10 text-[#2F65AB] border-[#2F65AB]/20"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

function QuickActionCard({ action }: { action: QuickActionItem }) {
  return (
    <Link
      href={action.href}
      className="group flex items-start gap-4 rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.06]"
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors", action.iconBg)}>
        <action.Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-slate-800 group-hover:text-slate-900">{action.title}</h4>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{action.description}</p>
      </div>
      <ArrowRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </Link>
  );
}

function StepItem({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2F65AB] text-xs font-bold text-white">
        {number}
      </span>
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}

/* ===== Monthly Calendar ===== */

interface MeetingItem { id: number; title: string; meetingDate: string | null; startTime: string | null; endTime: string | null; location: string | null; participantCount: number; }

const LAO_MONTHS = ["", "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];
const DAY_LABELS = ["ຈ", "ອ", "ພ", "ພຫ", "ສ", "ສ", "ອາ"];

function MonthlyCalendar({ meetings }: { meetings: MeetingItem[] }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Group meetings by date and sort by time
  const meetingsByDate = useMemo(() => {
    const map = new Map<string, MeetingItem[]>();
    for (const m of meetings) {
      if (!m.meetingDate) continue;
      const existing = map.get(m.meetingDate) || [];
      existing.push(m);
      map.set(m.meetingDate, existing);
    }
    // Sort each day's meetings by startTime
    for (const [, items] of map) {
      items.sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
    }
    return map;
  }, [meetings]);

  // Upcoming meetings (today + future), sorted by date then time
  const upcoming = useMemo(() => {
    return meetings
      .filter((m) => m.meetingDate && m.meetingDate >= todayStr)
      .sort((a, b) => {
        const dateCmp = (a.meetingDate || "").localeCompare(b.meetingDate || "");
        if (dateCmp !== 0) return dateCmp;
        return (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
      });
  }, [meetings, todayStr]);

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells: Array<{ day: number | null; dateStr: string }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, dateStr: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const selectedMeetings = selectedDate ? (meetingsByDate.get(selectedDate) || []) : [];

  return (
    <section className="space-y-3">
      {/* Calendar card */}
      <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm">
        {/* Month header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <button type="button" onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">{LAO_MONTHS[month + 1]}</p>
            <p className="text-[0.6rem] text-slate-400">{year}</p>
          </div>
          <button type="button" onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none"><path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 px-3 pt-3">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="py-1 text-center text-[0.6rem] font-semibold text-slate-400">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
          {cells.map((cell, i) => {
            if (!cell.day) return <div key={`empty-${i}`} />;
            const isToday = cell.dateStr === todayStr;
            const hasMeeting = meetingsByDate.has(cell.dateStr);
            const isFuture = cell.dateStr >= todayStr;
            const isSelected = cell.dateStr === selectedDate;

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                className={cn(
                  "relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition-all",
                  isSelected
                    ? "bg-[#2F65AB] font-bold text-white"
                    : isToday
                      ? "bg-[#2F65AB]/10 font-bold text-[#2F65AB]"
                      : hasMeeting && isFuture
                        ? "font-semibold text-[#2F65AB]"
                        : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {cell.day}
                {hasMeeting && !isSelected && (
                  <span className={cn(
                    "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                    isFuture ? "bg-[#2F65AB]" : "bg-slate-300"
                  )} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDate && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">{formatDate(selectedDate)}</p>
            {selectedMeetings.length === 0 ? (
              <p className="text-xs text-slate-400">ບໍ່ມີການປະຊຸມ</p>
            ) : (
              <div className="space-y-2">
                {selectedMeetings.map((m) => (
                  <Link key={m.id} href="/meetings" className="block rounded-lg bg-[#2F65AB]/5 px-3 py-2 transition-colors hover:bg-[#2F65AB]/10">
                    <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                    <p className="text-xs text-slate-400">
                      {m.startTime && <span>{m.startTime}{m.endTime ? ` - ${m.endTime}` : ""}</span>}
                      {m.location && <span>{m.startTime ? " · " : ""}{m.location}</span>}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming meetings timeline */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">ປະຊຸມລ່ວງໜ້າ</p>
            <Link href="/meetings" className="text-xs font-medium text-[#2F65AB] hover:underline">ທັງໝົດ</Link>
          </div>
          <div className="space-y-0">
            {upcoming.slice(0, 6).map((m, i) => {
              // Show date header when date changes
              const prevDate = i > 0 ? upcoming[i - 1].meetingDate : null;
              const showDateHeader = m.meetingDate !== prevDate;
              const isToday = m.meetingDate === todayStr;

              return (
                <div key={m.id}>
                  {showDateHeader && (
                    <div className={cn("flex items-center gap-2 pb-1", i > 0 && "pt-3")}>
                      <span className={cn(
                        "rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold",
                        isToday ? "bg-[#2F65AB] text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {isToday ? "ມື້ນີ້" : formatDate(m.meetingDate || "")}
                      </span>
                    </div>
                  )}
                  <Link href="/meetings" className="flex items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-[#2F65AB]/5">
                    {/* Time */}
                    <div className="w-12 shrink-0 pt-0.5 text-right">
                      <p className="text-xs font-semibold text-[#2F65AB]">{m.startTime || "--:--"}</p>
                      {m.endTime && <p className="text-[0.6rem] text-slate-300">{m.endTime}</p>}
                    </div>
                    {/* Line */}
                    <div className="flex flex-col items-center pt-1">
                      <span className="h-2 w-2 rounded-full bg-[#2F65AB]" />
                      <span className="mt-0.5 w-px flex-1 bg-slate-200" />
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                      <p className="text-xs text-slate-400">
                        {m.location && <span>{m.location}</span>}
                        {m.participantCount > 0 && <span>{m.location ? " · " : ""}{m.participantCount} ຄົນ</span>}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== Icons ===== */

function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><path d="M4 10h11.5m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function OrgChartIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><rect x="7" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" /><rect x="1.5" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" /><rect x="12.5" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" /><path d="M10 6v3m0 0H4.5m5.5 0h5.5m-11 0v4m11-4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function ClipboardCheckIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><path d="M7.5 2.5h5a1 1 0 0 1 1 1V4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M6.5 4H5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 15 4h-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7.5 11.5 9 13l3.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function UserCheckIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M13.5 10.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function UserPlusIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M16 8v4m-2-2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function BookIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><path d="M5.75 4.25h7.5A1.75 1.75 0 0 1 15 6v9.75H7.25A2.25 2.25 0 0 0 5 18V5a.75.75 0 0 1 .75-.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M5 15.75h8.75M8 7.5h4.5M8 10h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function CalendarPlusIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M6.5 2.5v4M13.5 2.5v4M3 8h14M10 10.5v4M8 12.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MeetingIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><circle cx="7" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="13" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 16c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M9 16c0-2.5 2-4.5 4.5-4.5S18 13.5 18 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function SettingsIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.6" /><path d="M16.2 12.2a1.2 1.2 0 0 0 .24 1.32l.04.04a1.46 1.46 0 1 1-2.06 2.06l-.04-.04a1.2 1.2 0 0 0-1.32-.24 1.2 1.2 0 0 0-.73 1.1v.12a1.46 1.46 0 0 1-2.92 0v-.06a1.2 1.2 0 0 0-.78-1.1 1.2 1.2 0 0 0-1.32.24l-.04.04a1.46 1.46 0 1 1-2.06-2.06l.04-.04a1.2 1.2 0 0 0 .24-1.32 1.2 1.2 0 0 0-1.1-.73h-.12a1.46 1.46 0 0 1 0-2.92h.06a1.2 1.2 0 0 0 1.1-.78 1.2 1.2 0 0 0-.24-1.32l-.04-.04a1.46 1.46 0 1 1 2.06-2.06l.04.04a1.2 1.2 0 0 0 1.32.24h.06a1.2 1.2 0 0 0 .73-1.1v-.12a1.46 1.46 0 0 1 2.92 0v.06a1.2 1.2 0 0 0 .73 1.1 1.2 1.2 0 0 0 1.32-.24l.04-.04a1.46 1.46 0 1 1 2.06 2.06l-.04.04a1.2 1.2 0 0 0-.24 1.32v.06a1.2 1.2 0 0 0 1.1.73h.12a1.46 1.46 0 0 1 0 2.92h-.06a1.2 1.2 0 0 0-1.1.73Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
