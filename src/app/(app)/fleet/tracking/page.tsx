import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { livePositions } from "@/lib/fleet-live";
import LiveView from "./live-view";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const positions = await livePositions();

  return (
    <>
      <PageHeader
        title="ຕິດຕາມຕຳແໜ່ງລົດ"
        subtitle="ຮັບພິກັດຈິງຈາກ Lao GPS ທຸກ 20 ວິນາທີ · ລົດທີ່ແລ່ນເຄື່ອນຕາມຄວາມໄວ/ທິດທາງທຸກວິນາທີ · ຊູມດ້ວຍລໍ້ເມົ້າ ຫຼື ປຸ່ມ +/−"
      />
      <LiveView initial={positions} />
    </>
  );
}
