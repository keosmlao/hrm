import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { allowedMenuKeys, canOpenPath } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  // ບັງຄັບສິດເມນູໃຫ້ທຸກໜ້າໃນກຸ່ມນີ້ບ່ອນດຽວ — ເຊື່ອງເມນູຢ່າງດຽວກັນບໍ່ໄດ້
  // ເພາະຜູ້ໃຊ້ພິມ URL ເອງໄດ້
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname && !(await canOpenPath(session.role, pathname, session.userId))) {
    redirect("/dashboard?error=no_permission");
  }
  const allowed = [...(await allowedMenuKeys(session.role, session.userId))];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-sm">
            OD
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">ODIEN HRM</p>
            <p className="text-xs text-muted">ບໍລິຫານບຸກຄະລາກອນ</p>
          </div>
        </div>

        <Sidebar allowed={allowed} />

        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium">{session.name}</p>
          <p className="mb-3 text-xs text-muted">{ROLE_LABEL[session.role]}</p>
          <form action={logout}>
            <button className="w-full rounded-lg border border-border px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">
              ອອກຈາກລະບົບ
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#5d3e55] bg-primary px-4 text-white shadow-sm lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white">
              OD
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">ODIEN HRM</p>
              <p className="truncate text-xs text-white/70">{session.name}</p>
            </div>
          </div>

          <details className="group relative">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-white/20 text-white transition hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">ເປີດເມນູ</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="absolute right-0 mt-2 flex max-h-[calc(100vh-5rem)] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              <Sidebar allowed={allowed} />
              <div className="border-t border-border p-4">
                <p className="truncate text-sm font-medium">{session.name}</p>
                <p className="mb-3 text-xs text-muted">{ROLE_LABEL[session.role]}</p>
                <form action={logout}>
                  <button className="w-full rounded-lg border border-border px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                    ອອກຈາກລະບົບ
                  </button>
                </form>
              </div>
            </div>
          </details>
        </header>

        <main className="overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
