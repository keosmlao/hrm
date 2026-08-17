"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../../login/actions";

export default function EmployeeLoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">
            OD
          </div>
          <h1 className="text-xl font-semibold">ODIEN Employee App</h1>
          <p className="mt-1 text-sm text-slate-500">ລະບົບສຳລັບພະນັກງານ</p>
        </div>

        {/* Desktop / ຄອມ — ເຂົ້າດ້ວຍລະຫັດພະນັກງານ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-center font-medium">ເຂົ້າສູ່ລະບົບພະນັກງານ</h2>
          <p className="mb-4 text-center text-xs text-slate-500">ໃສ່ລະຫັດພະນັກງານ ແລະ ລະຫັດຜ່ານ</p>

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="redirectTo" value="/employee" />
            <input
              name="username"
              autoComplete="username"
              autoFocus
              placeholder="ລະຫັດພະນັກງານ"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="ລະຫັດຜ່ານ"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            {state.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
            )}
            <button
              disabled={pending}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "ກຳລັງເຂົ້າສູ່ລະບົບ..." : "ເຂົ້າສູ່ລະບົບ"}
            </button>
          </form>

          {/* ມືຖື — ເຂົ້າຜ່ານ LINE */}
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            ຫຼື ໃຊ້ມືຖື
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <a
            href="/clock"
            className="block w-full rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            ເຂົ້າດ້ວຍ LINE (ມືຖື)
          </a>
        </div>
      </div>
    </div>
  );
}
