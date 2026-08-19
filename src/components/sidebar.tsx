"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { MENU, menuForPath, type IconName } from "@/lib/menu";

/** spinner ນ້ອຍໆ ຕອນກົດ link ແລ້ວກຳລັງໂຫຼດໜ້າໃໝ່ */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
  );
}


function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    employees: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    attendance: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    leave: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15l2 2 4-4"/></>,
    overtime: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2M19 5l2-2"/></>,
    payroll: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h5M7 10h4M7 14h2"/><circle cx="16" cy="13" r="1"/></>,
    appraisal: <><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></>,
    org: <><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/></>,
    recruitment: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    assets: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></>,
    fleet: <><path d="M3 17V7a1 1 0 0 1 1-1h10v11M14 9h4l3 3v5"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></>,
    trips: <><path d="M4 19V6l5-2 6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M9 4v13M15 6v13"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20.3h-3v-.09a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.55-1.03H5.3v-3h.15A1.7 1.7 0 0 0 7 9.94a1.7 1.7 0 0 0-.34-1.88L6.6 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.7V4.6h3v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.15v3h-.15A1.7 1.7 0 0 0 19.4 15z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Sidebar({ allowed }: { allowed: string[] }) {
  const visible = new Set(allowed);
  const pathname = usePathname();
  // ⚠ ຢ່າໃຊ້ startsWith ຊື່ໆ — `/fleet/fuel/review` ຈະຕິດໄຟທັງ "ລາຍງານນ້ຳມັນ" ແລະ "ກວດເຫດການນ້ຳມັນ".
  // menuForPath ເອົາ href ທີ່ຍາວສຸດທີ່ກົງ ຈຶ່ງເຫຼືອອັນດຽວ (ໜ້າຍ່ອຍທີ່ເຊື່ອງ → ບໍ່ມີອັນໃດຕິດໄຟ)
  const activeKey = menuForPath(pathname)?.key ?? null;

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {MENU.map((group) => {
        const items = group.items.filter((i) => visible.has(i.key) && !i.hiddenFromSidebar);
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.key === activeKey;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                        active
                          ? "bg-primary font-medium text-white shadow-sm"
                          : "text-slate-600 hover:bg-primary/8 hover:text-primary"
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                      <NavPending />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
