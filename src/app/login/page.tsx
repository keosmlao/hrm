"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

/**
 * ໜ້າເຂົ້າສູ່ລະບົບ — ໃຊ້ໂຄງສ້າງແບບດຽວກັບ TMS (ແບ່ງສອງຝັ່ງ: ພາເນວແບຣນ + ຟອມ)
 * ພ້ອມ **ຊຸດສີດຽວກັນ** (navy → teal) ຕາມທີ່ຜູ້ໃຊ້ຂໍ ເພື່ອໃຫ້ສອງລະບົບຂອງ ODG
 * ຮູ້ສຶກເປັນຊຸດດຽວກັນ. ສີໃນໜ້າອື່ນຂອງ HRM ຍັງເປັນ `--primary` ຕາມເດີມ.
 *
 * ບໍ່ໃຊ້ react-icons (HRM ບໍ່ມີ dependency ນັ້ນ) — ໃຊ້ SVG ຝັງໃນໄຟລ໌ຄືກັບ sidebar.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* ວົງມົນເບລີ້ມພື້ນຫຼັງ */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-cyan-300/15 blur-3xl" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* ຝັ່ງຊ້າຍ — ພາເນວແບຣນ */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#003260] via-[#12497f] to-[#2c6fb6] lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            }}
          />
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-300/15 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">
              OD
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">ODIEN HRM</p>
              <p className="text-[11px] tracking-[0.18em] text-teal-200/70 uppercase">Human Resources</p>
            </div>
          </div>

          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 text-[11px] font-medium tracking-wider text-teal-200 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_8px_rgba(94,234,212,0.8)]" />
              ODG · HRM 2026
            </span>
            <h2 className="mt-5 text-4xl leading-tight font-bold">
              ບໍລິຫານບຸກຄະລາກອນ
              <br />
              <span className="bg-gradient-to-r from-sky-200 via-sky-100 to-amber-200 bg-clip-text text-transparent">
                ໃຫ້ງ່າຍຂຶ້ນ
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300/85">
              ຂໍ້ມູນພະນັກງານ, ການລົງເວລາ, ການລາພັກ, ເງິນເດືອນ ແລະ ການນຳໃຊ້ລົດ — ຢູ່ບ່ອນດຽວ.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <Feature label="ລົງເວລາ" icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
              <Feature label="ເງິນເດືອນ" icon={<><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h5M7 10h4M7 14h2" /></>} />
              <Feature label="ຈັດການລົດ" icon={<><path d="M3 17V7a1 1 0 0 1 1-1h10v11M14 9h4l3 3v5" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" /></>} />
            </div>
          </div>

          <div className="relative flex items-center justify-between text-xs text-slate-400">
            <p>&copy; {new Date().getFullYear()} ODIEN GROUP</p>
            <p className="font-medium text-teal-200/80">v2026.1</p>
          </div>
        </div>

        {/* ຝັ່ງຂວາ — ຟອມ */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            {/* ຫົວແບຣນສະເພາະຈໍນ້ອຍ */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003260] to-[#2c6fb6] text-base font-bold text-white">
                OD
              </div>
              <div className="leading-tight">
                <p className="font-semibold">ODIEN HRM</p>
                <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Human Resources</p>
              </div>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">ຍິນດີຕ້ອນຮັບກັບມາ 👋</h1>
              <p className="mt-2 text-sm text-slate-500">ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອສືບຕໍ່ໃຊ້ງານ HRM</p>
            </div>

            {state.error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200/70 bg-rose-50/80 p-3.5">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                  !
                </span>
                <p className="text-sm leading-relaxed text-rose-700">{state.error}</p>
              </div>
            )}

            <form action={formAction} className="space-y-5">
              {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດພະນັກງານ
                </label>
                <div className="group relative">
                  <Icon className="group-focus-within:text-teal-600 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 transition-colors">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </Icon>
                  <input
                    name="username"
                    autoComplete="username"
                    autoFocus
                    required
                    placeholder="ເຊັ່ນ 24084"
                    className="focus:border-teal-500 focus:ring-teal-500/20 h-12 w-full rounded-xl border border-border bg-white pr-4 pl-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  ລະຫັດຜ່ານ
                </label>
                <div className="group relative">
                  <Icon className="group-focus-within:text-teal-600 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 transition-colors">
                    <rect x="4" y="11" width="16" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </Icon>
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="ປ້ອນລະຫັດຜ່ານ"
                    className="focus:border-teal-500 focus:ring-teal-500/20 h-12 w-full rounded-xl border border-border bg-white pr-12 pl-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "ເຊື່ອງລະຫັດຜ່ານ" : "ສະແດງລະຫັດຜ່ານ"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Icon>
                      {showPassword ? (
                        <>
                          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a12 12 0 0 1-2.4 3.3M6.2 6.7C3.9 8.2 3 10.4 3 12c0 2.5 4 7 9 7 1.2 0 2.3-.2 3.3-.6" />
                        </>
                      ) : (
                        <>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </Icon>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="group focus:ring-teal-500/30 relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-800 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition-all hover:from-teal-400 hover:to-teal-700 hover:shadow-xl focus:ring-4 focus:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {pending ? (
                  <>
                    <Icon className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                    </Icon>
                    <span>ກຳລັງເຂົ້າສູ່ລະບົບ...</span>
                  </>
                ) : (
                  <>
                    <span>ເຂົ້າສູ່ລະບົບ</span>
                    <Icon className="transition-transform group-hover:translate-x-0.5">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </Icon>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200/70 pt-5 text-center">
              <p className="text-xs text-slate-400">
                ມີບັນຫາໃນການເຂົ້າສູ່ລະບົບ? ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ
              </p>
              <p className="mt-3 text-xs text-slate-400 lg:hidden">
                &copy; {new Date().getFullYear()} ODIEN GROUP
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Icon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-[18px] w-[18px] shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur transition-colors hover:border-teal-300/30 hover:bg-white/[0.07]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15 text-teal-200">
        <Icon>{icon}</Icon>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-200/90">{label}</p>
    </div>
  );
}
