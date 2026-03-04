import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import LogoutButton from "./logout-button";

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

type IconProps = {
  className?: string;
};

interface QuickActionItem {
  href: string;
  title: string;
  description: string;
  tag: string;
  Icon: (props: IconProps) => ReactNode;
  accent: "violet" | "teal" | "rose" | "amber" | "blue";
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    href: "/training-need",
    title: "ຄວາມຕ້ອງການຝຶກອົບຮົມ",
    description: "ສົ່ງຄຳຂໍຝຶກອົບຮົມ ແລະ ຕິດຕາມສະຖານະ.",
    tag: "Learning",
    Icon: BookIcon,
    accent: "teal",
  },
  {
    href: "/org-chart",
    title: "ໂຄງສ້າງອົງກອນ",
    description: "ເບິ່ງຜັງອົງກອນ ແລະ ສາຍງານຂອງທ່ານ.",
    tag: "Structure",
    Icon: OrgChartIcon,
    accent: "amber",
  },
  {
    href: "/performance-evaluation",
    title: "ປະເມີນຜົນງານ OD 2026",
    description: "ຈັດການແບບປະເມີນ OD 2026 ໃນຫນ້າດຽວ.",
    tag: "OD 2026",
    Icon: ClipboardCheckIcon,
    accent: "violet",
  },
  {
    href: "/staff-evaluation",
    title: "ປະເມີນຜົນງານ",
    description: "ປະເມີນຕົນເອງ ແລະ ປະເມີນລູກທີມ.",
    tag: "Review",
    Icon: UserCheckIcon,
    accent: "blue",
  },
  {
    href: "/staff-eval-assign",
    title: "ຕັ້ງຄ່າຜູ້ຖືກປະເມີນ",
    description: "ເພີ່ມຄົນເຂົ້າລາຍການປະເມີນເພີ່ມເຕີມ.",
    tag: "Setup",
    Icon: UserPlusIcon,
    accent: "rose",
  },
];

async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session) return null;

  try {
    return JSON.parse(Buffer.from(session.value, "base64").toString());
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const empRow = await prisma.odg_employee.findFirst({
    where: session.employee?.employeeCode
      ? { employee_code: session.employee.employeeCode }
      : { line_id: session.lineUserId },
    include: {
      odg_position_rel: true,
      odg_department_rel: true,
      odg_unit_rel: true,
      odg_division_rel: true,
    },
  });

  const emp = empRow
    ? {
        title_lo: empRow.title_lo,
        fullname_lo: empRow.fullname_lo,
        title_en: empRow.title_en,
        fullname_en: empRow.fullname_en,
        employee_code: empRow.employee_code,
        employment_status: empRow.employment_status,
        hire_date: empRow.hire_date,
        position_name_lo: empRow.odg_position_rel?.position_name_lo ?? null,
        unit_name_lo: empRow.odg_unit_rel?.unit_name_lo ?? null,
        department_name_lo: empRow.odg_department_rel?.department_name_lo ?? null,
        division_name_lo: empRow.odg_division_rel?.division_name_lo ?? null,
      }
    : null;

  const displayName = emp?.fullname_lo || session.lineDisplayName || "User";
  const englishName = [emp?.title_en, emp?.fullname_en].filter(Boolean).join(" ");
  const employmentStatus = formatEmploymentStatus(emp?.employment_status);
  const employmentTone = getStatusTone(emp?.employment_status);
  const workAge = emp?.hire_date ? calcWorkAge(emp.hire_date) : "-";
  const joinedOn = formatDate(emp?.hire_date);
  const todayLabel = formatDate(new Date());
  const positionName = getDisplayValue(emp?.position_name_lo);
  const unitName = getDisplayValue(emp?.unit_name_lo);
  const departmentName = getDisplayValue(emp?.department_name_lo);
  const primaryAffiliation = unitName
    ? { label: "ໜ່ວຍງານ", value: unitName }
    : departmentName
      ? { label: "ພະແນກ", value: departmentName }
      : null;

  return (
    <div className="aurora-page min-h-screen text-slate-900">
      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f0f4f8]">
        <div className="aurora-blob-1 absolute -left-[20%] -top-[10%] h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35)_0%,rgba(167,139,250,0.08)_50%,transparent_70%)]" />
        <div className="aurora-blob-2 absolute -right-[10%] top-[5%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.3)_0%,rgba(56,189,248,0.06)_50%,transparent_70%)]" />
        <div className="aurora-blob-3 absolute bottom-[0%] left-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.25)_0%,rgba(52,211,153,0.05)_50%,transparent_70%)]" />
        <div className="aurora-blob-4 absolute -bottom-[15%] right-[10%] h-[550px] w-[550px] rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.18)_0%,rgba(251,146,60,0.04)_50%,transparent_70%)]" />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <AuroraBrandMark />
            <div className="min-w-0">
              <p className="text-[0.56rem] font-bold uppercase tracking-[0.32em] text-violet-500/70">
                AI-Powered HRM
              </p>
              <h1 className="truncate text-sm font-semibold text-slate-800">
                ODG Employee Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden rounded-xl border border-slate-200/60 bg-white/60 px-3.5 py-1.5 text-right backdrop-blur sm:block">
              <p className="text-[0.56rem] font-medium uppercase tracking-[0.24em] text-slate-400">
                Today
              </p>
              <p className="text-sm font-semibold text-slate-700">{todayLabel}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-7">
        {emp ? (
          <>
            {/* Profile Section */}
            <section className="overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-2xl">
              {/* Gradient header bar */}
              <div className="relative overflow-hidden bg-gradient-to-r from-violet-500 via-blue-500 to-teal-400 px-5 py-5 sm:px-7 sm:py-6">
                {/* Aurora mesh inside header */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
                  <div className="absolute -bottom-10 left-20 h-40 w-40 rounded-full bg-emerald-300/20 blur-2xl" />
                  <div className="absolute right-1/3 top-0 h-32 w-32 rounded-full bg-pink-300/15 blur-2xl" />
                </div>
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="aurora-pulse inline-block h-2 w-2 rounded-full bg-white" />
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-white/90">
                        Employee Profile
                      </p>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-white/70">
                      ຂໍ້ມູນ profile ແລະ ສະຖານະຂອງທ່ານ
                    </p>
                  </div>
                  <StatusBadge label={employmentStatus} tone={employmentTone} />
                </div>
              </div>

              <div className="px-5 py-5 sm:px-7 sm:py-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
                  {/* Profile info */}
                  <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <Avatar
                        src={session.linePictureUrl}
                        name={displayName}
                        className="h-16 w-16 text-xl shadow-[0_8px_24px_-6px_rgba(139,92,246,0.3)] ring-[3px] ring-white sm:h-[4.5rem] sm:w-[4.5rem] sm:text-2xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-400">
                          LINE: {session.lineDisplayName || "-"}
                        </p>
                        <h2 className="mt-1 break-words text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 sm:text-[1.85rem]">
                          {emp.title_lo ? `${emp.title_lo} ` : ""}
                          {emp.fullname_lo || "-"}
                        </h2>
                        {englishName && (
                          <p className="mt-1 text-sm text-slate-400">
                            {englishName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <MetaChip
                        label={positionName || "ບໍ່ລະບຸ"}
                        color="violet"
                      />
                      {primaryAffiliation && (
                        <MetaChip
                          label={primaryAffiliation.value}
                          color="teal"
                        />
                      )}
                    </div>
                  </div>

                  {/* Side panel */}
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50/80 p-4">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-violet-400">
                        Today
                      </p>
                      <p className="mt-1.5 text-lg font-bold text-violet-900">
                        {todayLabel}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50/80 p-4">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-teal-400">
                        LINE Name
                      </p>
                      <p className="mt-1.5 break-words text-sm font-semibold text-teal-900">
                        {session.lineDisplayName || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="ລະຫັດພະນັກງານ" value={emp.employee_code || "-"} color="violet" />
                  <StatCard label="ອາຍຸງານ" value={workAge} color="blue" />
                  <StatCard label="ວັນເຂົ້າວຽກ" value={joinedOn} color="teal" />
                  <StatCard label="ສະຖານະ" value={employmentStatus} color="emerald" />
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="mt-6 rounded-[1.4rem] border border-white/70 bg-white/60 p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-2xl sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500">
                      <SparkleIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-violet-600">
                      Smart Actions
                    </p>
                  </div>
                  <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-slate-900 sm:text-2xl">
                    ເມນູດ່ວນສຳລັບວຽກ HR
                  </h3>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-400">
                  ເຂົ້າເຖິງ workflow ທີ່ໃຊ້ບ່ອຍໄດ້ຢ່າງໄວ
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {QUICK_ACTIONS.map((action) => (
                  <QuickActionCard key={action.href} action={action} />
                ))}
              </div>
            </section>
          </>
        ) : (
          /* Not linked */
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <section className="overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
              <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-400 px-5 pb-10 pt-5 sm:px-7 sm:pb-12 sm:pt-6">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                  <div className="absolute -bottom-8 left-16 h-32 w-32 rounded-full bg-yellow-200/20 blur-2xl" />
                </div>
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="aurora-pulse inline-block h-2 w-2 rounded-full bg-white" />
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-white/90">
                        Account Check
                      </p>
                    </div>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-white/75">
                      ບັນຊີ LINE ນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile.
                    </p>
                  </div>
                  <StatusBadge label="ຕ້ອງກວດສອບ" tone="warning" />
                </div>
              </div>

              <div className="relative px-5 pb-5 sm:px-7 sm:pb-6">
                <div className="-mt-7 flex flex-col gap-4 sm:-mt-8 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 items-end gap-3">
                    <Avatar
                      src={session.linePictureUrl}
                      name={session.lineDisplayName || "?"}
                      className="h-16 w-16 text-xl ring-4 ring-white shadow-[0_8px_24px_-6px_rgba(245,158,11,0.3)] sm:h-20 sm:w-20 sm:text-2xl"
                    />
                    <div className="min-w-0 pb-1">
                      <p className="text-xs font-medium text-slate-400">LINE account</p>
                      <h2 className="mt-1 break-words text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 sm:text-[1.95rem]">
                        {session.lineDisplayName || "-"}
                      </h2>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-white/80 px-3.5 py-2 backdrop-blur">
                    <p className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-400">
                      Today
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {todayLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <FieldRow label="ຊື່ LINE" value={session.lineDisplayName || "-"} />
                  <FieldRow label="LINE User ID" value={session.lineUserId} wrap />
                </div>

                <div className="mt-5 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-sm leading-6 text-amber-800">
                  ກະລຸນາສົ່ງ LINE User ID ໃຫ້ HR ຫຼື admin
                  ເພື່ອກວດສອບການເຊື່ອມຂໍ້ມູນ ແລ້ວຈຶ່ງເຂົ້າລະບົບໃໝ່ອີກຄັ້ງ.
                </div>
              </div>
            </section>

            <PanelCard
              title="ຂັ້ນຕອນຕໍ່ໄປ"
              description="ເມື່ອຈັບຄູ່ຂໍ້ມູນສຳເລັດ profile ຈະປາກົດໃນຫນ້ານີ້."
            >
              <div className="space-y-3">
                <StepItem number="01" text="ສົ່ງ LINE User ID ໃຫ້ HR ຫຼື admin" color="violet" />
                <StepItem number="02" text="ລໍຖ້າການກວດສອບແລະຈັບຄູ່ຂໍ້ມູນ" color="blue" />
                <StepItem number="03" text="ອອກຈາກລະບົບ ແລະ ເຂົ້າໃໝ່ອີກຄັ້ງ" color="teal" />
              </div>
            </PanelCard>
          </section>
        )}
      </main>
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function calcWorkAge(hireDate: string | Date): string {
  const hire = new Date(hireDate);
  if (Number.isNaN(hire.getTime())) return "-";

  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  let days = now.getDate() - hire.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ປີ`);
  if (months > 0) parts.push(`${months} ເດືອນ`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ມື້`);

  return parts.join(" ");
}

function formatEmploymentStatus(status: string | null | undefined): string {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "ກຳລັງໃຊ້ງານ";
    case "INACTIVE":
      return "ບໍ່ໄດ້ໃຊ້ງານ";
    default:
      return status ? status.replaceAll("_", " ") : "-";
  }
}

function getStatusTone(status: string | null | undefined) {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "success" as const;
    case "INACTIVE":
      return "neutral" as const;
    default:
      return "warning" as const;
  }
}

/* ===== UI Components ===== */

function AuroraBrandMark() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[0.85rem] bg-gradient-to-br from-violet-600 via-blue-500 to-teal-400 shadow-[0_4px_16px_-3px_rgba(139,92,246,0.4)]"
    >
      <div className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-white/20 blur-lg" />
      <div className="relative flex flex-col items-center">
        <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-white">
          ODG
        </span>
        <span className="text-[0.36rem] font-bold uppercase tracking-[0.2em] text-white/70">
          AI HRM
        </span>
      </div>
    </div>
  );
}

function Avatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className: string;
}) {
  return src ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className={cn(className, "rounded-2xl bg-white object-cover")}
      />
    </>
  ) : (
    <div
      className={cn(
        className,
        "flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-blue-400 font-bold text-white"
      )}
    >
      {getInitial(name)}
    </div>
  );
}

function MetaChip({ label, color }: { label: string; color: "violet" | "teal" }) {
  const colorClass = color === "violet"
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : "border-teal-200 bg-teal-50 text-teal-700";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium", colorClass)}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", color === "violet" ? "bg-violet-400" : "bg-teal-400")} />
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "violet" | "blue" | "teal" | "emerald";
}) {
  const styles = {
    violet: "border-violet-100 from-violet-50/80 to-white",
    blue: "border-blue-100 from-blue-50/80 to-white",
    teal: "border-teal-100 from-teal-50/80 to-white",
    emerald: "border-emerald-100 from-emerald-50/80 to-white",
  }[color];

  const dotColor = {
    violet: "bg-violet-400",
    blue: "bg-blue-400",
    teal: "bg-teal-400",
    emerald: "bg-emerald-400",
  }[color];

  return (
    <div className={cn("rounded-2xl border bg-gradient-to-b px-3.5 py-3 transition-all hover:shadow-sm", styles)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotColor)} />
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-2 break-words text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.4rem] border border-white/70 bg-white/60 p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:p-6">
      <h3 className="text-lg font-bold tracking-[-0.02em] text-slate-900">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white/80 px-3.5 py-3">
      <p className="min-w-0 text-sm text-slate-400">{label}</p>
      <p
        className={cn(
          "max-w-[62%] text-right text-sm font-semibold text-slate-800",
          wrap ? "break-all" : "break-words"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StepItem({ number, text, color }: { number: string; text: string; color: "violet" | "blue" | "teal" }) {
  const gradients = {
    violet: "from-violet-500 to-purple-600",
    blue: "from-blue-500 to-indigo-600",
    teal: "from-teal-500 to-emerald-600",
  }[color];

  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[0.62rem] font-bold text-white shadow-sm", gradients)}>
        {number}
      </span>
      <p className="pt-0.5 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function QuickActionCard({ action }: { action: QuickActionItem }) {
  const config = {
    violet: {
      border: "hover:border-violet-200",
      icon: "from-violet-500 to-purple-600",
      tag: "border-violet-200 bg-violet-50 text-violet-700",
      bar: "from-violet-500 via-purple-500 to-fuchsia-400",
      shadow: "hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.2)]",
    },
    teal: {
      border: "hover:border-teal-200",
      icon: "from-teal-500 to-emerald-600",
      tag: "border-teal-200 bg-teal-50 text-teal-700",
      bar: "from-teal-400 via-emerald-500 to-green-400",
      shadow: "hover:shadow-[0_12px_32px_-8px_rgba(20,184,166,0.2)]",
    },
    rose: {
      border: "hover:border-rose-200",
      icon: "from-rose-500 to-pink-600",
      tag: "border-rose-200 bg-rose-50 text-rose-700",
      bar: "from-rose-400 via-pink-500 to-fuchsia-400",
      shadow: "hover:shadow-[0_12px_32px_-8px_rgba(244,63,94,0.2)]",
    },
    amber: {
      border: "hover:border-amber-200",
      icon: "from-amber-500 to-orange-600",
      tag: "border-amber-200 bg-amber-50 text-amber-700",
      bar: "from-amber-400 via-orange-500 to-red-400",
      shadow: "hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.2)]",
    },
    blue: {
      border: "hover:border-blue-200",
      icon: "from-blue-500 to-indigo-600",
      tag: "border-blue-200 bg-blue-50 text-blue-700",
      bar: "from-blue-400 via-indigo-500 to-violet-400",
      shadow: "hover:shadow-[0_12px_32px_-8px_rgba(59,130,246,0.2)]",
    },
  }[action.accent];

  return (
    <Link
      href={action.href}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white",
        config.border,
        config.shadow
      )}
    >
      {/* Gradient accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100", config.bar)} />

      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm transition-shadow group-hover:shadow-md",
            config.icon
          )}
        >
          <action.Icon className="h-5 w-5 text-white" />
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.18em]",
            config.tag
          )}
        >
          {action.tag}
        </span>
      </div>
      <h4 className="mt-3 text-base font-bold tracking-[-0.02em] text-slate-900 sm:text-lg">
        {action.title}
      </h4>
      <p className="mt-1.5 flex-1 text-sm leading-6 text-slate-400">
        {action.description}
      </p>
      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors group-hover:text-slate-700">
        ເຂົ້າໄປເບິ່ງ
        <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "neutral";
}) {
  const cls =
    tone === "success"
      ? "bg-white/20 text-white ring-1 ring-white/30"
      : tone === "warning"
        ? "bg-white/20 text-white ring-1 ring-white/30"
        : "bg-white/20 text-white/80 ring-1 ring-white/20";

  return (
    <span className={cn("rounded-full px-3 py-1 text-[0.72rem] font-bold backdrop-blur", cls)}>
      {label}
    </span>
  );
}

function SparkleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0L9.5 5.5L16 8L9.5 10.5L8 16L6.5 10.5L0 8L6.5 5.5L8 0Z" />
    </svg>
  );
}

/* ===== Utility ===== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "?";
}

/* ===== Icons ===== */

function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M4 10h11.5m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OrgChartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="7" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1.5" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="12.5" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 6v3m0 0H4.5m5.5 0h5.5m-11 0v4m11-4v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipboardCheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M7.5 2.5h5a1 1 0 0 1 1 1V4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 4H5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 15 4h-1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11.5 9 13l3.5-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserCheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.5 10.5l1.5 1.5 3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserPlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 8v4m-2-2h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M5.75 4.25h7.5A1.75 1.75 0 0 1 15 6v9.75H7.25A2.25 2.25 0 0 0 5 18V5a.75.75 0 0 1 .75-.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M5 15.75h8.75M8 7.5h4.5M8 10h4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
