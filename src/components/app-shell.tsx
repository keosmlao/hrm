import Link from "next/link";
import type { ReactNode } from "react";

const AURORA_NOISE_DATA_URL =
  "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E";

type AccentTone = "violet" | "blue" | "teal" | "amber" | "rose";

const headerIconTones: Record<AccentTone, string> = {
  violet: "from-slate-950 via-violet-700 to-fuchsia-500",
  blue: "from-slate-950 via-sky-700 to-cyan-400",
  teal: "from-slate-950 via-emerald-700 to-teal-400",
  amber: "from-slate-950 via-orange-600 to-amber-400",
  rose: "from-slate-950 via-rose-700 to-pink-500",
};

const heroTones: Record<AccentTone, string> = {
  violet: "from-violet-600 via-fuchsia-500 to-pink-400",
  blue: "from-sky-600 via-cyan-500 to-blue-400",
  teal: "from-emerald-600 via-teal-500 to-cyan-400",
  amber: "from-orange-500 via-amber-400 to-yellow-300",
  rose: "from-rose-600 via-pink-500 to-orange-300",
};

const metricTones: Record<AccentTone, string> = {
  violet: "border-violet-100 bg-[linear-gradient(180deg,rgba(139,92,246,0.08),rgba(255,255,255,0.9))] text-violet-900",
  blue: "border-sky-100 bg-[linear-gradient(180deg,rgba(14,165,233,0.08),rgba(255,255,255,0.9))] text-sky-900",
  teal: "border-emerald-100 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.9))] text-emerald-900",
  amber: "border-amber-100 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.9))] text-amber-900",
  rose: "border-rose-100 bg-[linear-gradient(180deg,rgba(244,63,94,0.08),rgba(255,255,255,0.9))] text-rose-900",
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

export function AuroraBrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[1rem] bg-[linear-gradient(145deg,#0c1a2d_0%,#1d3e68_58%,#2F65AB_100%)] shadow-[0_12px_28px_-14px_rgba(47,101,171,0.75)]",
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_32%)]" />
      <div className="relative flex flex-col items-center">
        <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-white">ODG</span>
        <span className="text-[0.36rem] font-bold uppercase tracking-[0.2em] text-white/70">AI HRM</span>
      </div>
    </div>
  );
}

export function HeaderIconTile({
  children,
  accent = "violet",
  className,
}: {
  children: ReactNode;
  accent?: AccentTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-[1rem] bg-gradient-to-br text-white shadow-[0_14px_28px_-16px_rgba(15,23,42,0.7)]",
        headerIconTones[accent],
        className
      )}
    >
      {children}
    </div>
  );
}

export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.7rem] border border-white/80 bg-white/74 shadow-[0_24px_64px_-34px_rgba(15,23,42,0.28),0_0_0_1px_rgba(255,255,255,0.82)_inset] backdrop-blur-2xl",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  badge,
  accent = "violet",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  accent?: AccentTone;
  children?: ReactNode;
}) {
  return (
    <GlassPanel className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <div className={cn("absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b", heroTones[accent])} />
          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-3xl">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-[2rem]">{title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
              </div>
              {badge && (
                <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 lg:hidden">
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={cn("relative hidden overflow-hidden lg:flex lg:items-end lg:justify-end lg:px-5 lg:py-5", `bg-gradient-to-br ${heroTones[accent]}`)}>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/18 blur-2xl" />
            <div className="absolute bottom-0 left-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          </div>
          {badge && (
            <span className="relative inline-flex items-center rounded-full bg-white/18 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white ring-1 ring-white/35 backdrop-blur">
              {badge}
            </span>
          )}
        </div>
      </div>

      {children && (
        <div className="border-t border-white/70 px-5 py-5 sm:px-7 sm:py-6">
          {children}
        </div>
      )}
    </GlassPanel>
  );
}

export function PageMetric({
  label,
  value,
  tone = "violet",
}: {
  label: string;
  value: ReactNode;
  tone?: AccentTone;
}) {
  return (
    <div className={cn("rounded-[1.3rem] border px-4 py-3 shadow-[0_12px_26px_-20px_rgba(15,23,42,0.18)]", metricTones[tone])}>
      <p className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black tracking-[-0.03em]">{value}</p>
    </div>
  );
}

export function EmptyStatePanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <GlassPanel className="px-6 py-8 text-center sm:px-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0c1a2d_0%,#1d3e68_58%,#2F65AB_100%)] text-white shadow-[0_18px_34px_-18px_rgba(47,101,171,0.8)]">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8v5m0 3h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </GlassPanel>
  );
}

export function PageLoading({ label = "ກຳລັງໂຫຼດ..." }: { label?: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#edf2eb]">
      <AuroraBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 rounded-[1.8rem] border border-white/80 bg-white/74 px-8 py-7 shadow-[0_24px_58px_-28px_rgba(15,23,42,0.32)] backdrop-blur-2xl">
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-[#2F65AB]/20 border-t-[#2F65AB]" />
          <p className="text-sm font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  eyebrow = "AI-Powered HRM",
  icon,
  backHref = "/home",
  backLabel = "ກັບໜ້າຫຼັກ",
  actions,
  containerClassName = "max-w-5xl",
  mainClassName,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  containerClassName?: string;
  mainClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="aurora-page min-h-screen text-slate-900">
      <AuroraBackground />

      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <div className={cn("mx-auto w-full", containerClassName)}>
          <div className="flex w-full flex-col gap-3 rounded-[1.5rem] border border-white/80 bg-white/74 px-4 py-3 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.28)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {icon ?? <AuroraBrandMark />}
              <div className="min-w-0">
                <p className="text-[0.56rem] font-bold uppercase tracking-[0.32em] text-slate-400">{eyebrow}</p>
                <h1 className="truncate text-sm font-black text-slate-900 sm:text-base">{title}</h1>
                {description && <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">{description}</p>}
              </div>
            </div>

            {actions ?? (
              <Link
                href={backHref}
                className="inline-flex items-center justify-center gap-2 self-stretch rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:border-[#2F65AB]/30 hover:bg-[#2F65AB]/5 hover:text-[#2F65AB] sm:self-auto"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M11.5 4.5 6 10l5.5 5.5M6.5 10H18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {backLabel}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-6",
          containerClassName,
          mainClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}
