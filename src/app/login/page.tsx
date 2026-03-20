"use client";

import { useState } from "react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLineLogin = () => {
    setIsLoading(true);
    window.location.href = "/api/auth/line";
  };

  return (
    <main className="aurora-page relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0d1f17] via-[#0f2e1f] to-[#091a12] px-4">
      {/* Aurora background blobs */}
      <div className="aurora-blob-1 pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#14885a]/20 blur-[120px]" />
      <div className="aurora-blob-2 pointer-events-none absolute -right-24 top-1/4 h-[400px] w-[400px] rounded-full bg-[#46ad7a]/15 blur-[100px]" />
      <div className="aurora-blob-3 pointer-events-none absolute -bottom-20 left-1/3 h-[450px] w-[450px] rounded-full bg-[#0f6b47]/20 blur-[110px]" />
      <div className="aurora-blob-4 pointer-events-none absolute right-1/4 top-2/3 h-[300px] w-[300px] rounded-full bg-[#7dcaa2]/10 blur-[90px]" />

      {/* Subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Logo / Brand */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14885a] to-[#46ad7a] shadow-lg shadow-[#14885a]/30">
              <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">HRM System</h1>
              <p className="mt-1 text-sm text-white/50">ລະບົບບໍລິຫານຊັບພະຍາກອນບຸກຄົນ</p>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Login button */}
          <button
            type="button"
            onClick={handleLineLogin}
            disabled={isLoading}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-[#06C755] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#06C755]/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#06C755]/30 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {isLoading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <LineLogo className="h-5 w-5" />
            )}
            {isLoading ? "ກຳລັງເຂົ້າລະບົບ..." : "ເຂົ້າສູ່ລະບົບດ້ວຍ LINE"}
          </button>

          {/* Footer note */}
          <p className="mt-5 text-center text-xs text-white/30">
            ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ LINE ຂອງທ່ານ
          </p>
        </div>
      </div>
    </main>
  );
}

function LineLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}
