"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import AssignForm from "@/components/assign-form";
import { AppShell, EmptyStatePanel, HeaderIconTile, PageHero, PageLoading, PageMetric } from "@/components/app-shell";

export default function StaffEvalAssignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, unknown>>("/staff-eval-assign")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
          return;
        }
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PageLoading />;

  const assigned = Array.isArray(data?.assigned) ? (data?.assigned as never[]) : [];
  const candidates = Array.isArray(data?.candidates) ? (data?.candidates as never[]) : [];

  return (
    <AppShell
      title="ຕັ້ງຄ່າຜູ້ຖືກປະເມີນ"
      description="ເພີ່ມ ຫຼື ຖອນລາຍຊື່ຄົນທີ່ຕ້ອງປະເມີນເພີ່ມເຕີມ"
      icon={<HeaderIconTile accent="rose"><UserPlusIcon className="h-5 w-5" /></HeaderIconTile>}
      containerClassName="max-w-4xl"
    >
      <div className="space-y-6">
        <PageHero
          eyebrow="Assignment Setup"
          title="ຈັດການລາຍຊື່ຜູ້ຖືກປະເມີນແບບຍືດຫຍຸ່ນ"
          description="ໜ້ານີ້ຊ່ວຍໃຫ້ຫົວໜ້າ ແລະ ຜູ້ຈັດການກຳນົດລາຍຊື່ຄົນທີ່ຈະຖືກປະເມີນເພີ່ມນອກເຫນືອຈາກລູກທີມຫຼັກ."
          badge={accessDenied ? "Restricted" : "Manager Tools"}
          accent="rose"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <PageMetric label="Assigned" value={assigned.length} tone="rose" />
            <PageMetric label="Available" value={candidates.length} tone="teal" />
          </div>
        </PageHero>

        {accessDenied ? (
          <EmptyStatePanel
            title="ສະເພາະຫົວໜ້າ ແລະ ຜູ້ຈັດການ"
            description="ບັນຊີນີ້ບໍ່ມີສິດເຂົ້າໃຊ້ໜ້າຈັດການການ assign."
            action={<Link href="/home" className="inline-flex rounded-xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700">ກັບໜ້າຫຼັກ</Link>}
          />
        ) : data ? (
          <AssignForm assigned={assigned} candidates={candidates} />
        ) : (
          <EmptyStatePanel title="ບໍ່ພົບຂໍ້ມູນ" description="ລະບົບບໍ່ສາມາດໂຫຼດລາຍການ assign ແລະ candidate ໄດ້." />
        )}
      </div>
    </AppShell>
  );
}

function UserPlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 8v4m-2-2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
