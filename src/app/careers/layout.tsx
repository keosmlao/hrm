import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ຮ່ວມງານກັບພວກເຮົາ — ODIEN GROUP",
  description: "ຕຳແໜ່ງງານທີ່ເປີດຮັບສະໝັກ ແລະ ຟອມສະໝັກງານ ODIEN GROUP",
};

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Link href="/careers" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              OD
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">
                ODIEN GROUP
              </span>
              <span className="block text-xs text-muted">ຮ່ວມງານກັບພວກເຮົາ</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        © ODIEN GROUP · ຝ່າຍບຸກຄົນ
      </footer>
    </div>
  );
}
