import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

const SETTING_MENUS = [
  {
    href: "/settings/attendance",
    title: "ການລົງເວລາ",
    description: "ຮອບສະຫຼຸບການລົງເວລາປະຈຳເດືອນ",
    mark: "◷",
  },
  {
    href: "/settings/shifts",
    title: "ກະເຮັດວຽກ",
    description: "ເພີ່ມ–ລຶບກະ ແລະ ກຳນົດວັນເຮັດວຽກ",
    mark: "↻",
  },
  {
    href: "/settings/leave",
    title: "ການລາ",
    description: "ປະເພດການລາ, ຈຳນວນວັນ, ການຮັບເງິນ ແລະຫຼັກຖານ",
    mark: "▣",
  },
  {
    href: "/settings/overtime",
    title: "ອັດຕາ OT",
    description: "ກຳນົດອັດຕາວັນປົກກະຕິ, ວັນພັກ ແລະວັນບຸນ",
    mark: "×",
  },
  {
    href: "/settings/holidays",
    title: "ວັນພັກ",
    description: "ປະຕິທິນວັນພັກບໍລິສັດ ແລະວັນພັກປະຈຳປີ",
    mark: "◇",
  },
] as const;

export default async function SettingsPage() {
  await requireRole("ADMIN", "HR");

  return (
    <>
      <PageHeader
        title="ການຕັ້ງຄ່າ HR"
        subtitle="ເລືອກເມນູການຕັ້ງຄ່າທີ່ຕ້ອງການ"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SETTING_MENUS.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-xl font-semibold text-primary transition group-hover:bg-primary group-hover:text-white">
              {menu.mark}
            </span>
            <h2 className="font-semibold text-slate-800">{menu.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{menu.description}</p>
            <span className="mt-4 inline-block text-sm font-medium text-primary">ເປີດເມນູ →</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
