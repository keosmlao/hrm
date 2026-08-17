import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

export default async function MePage() {
  const session = await requireUser();
  if (session.employeeCode) redirect(`/employees/${session.employeeCode}`);

  return (
    <>
      <PageHeader title="ຂໍ້ມູນສ່ວນຕົວ" />
      <Card>
        <p className="py-8 text-center text-sm text-muted">
          ບັນຊີຜູ້ໃຊ້ນີ້ຍັງບໍ່ໄດ້ຜູກກັບຂໍ້ມູນພະນັກງານ — ຕິດຕໍ່ HR
        </p>
      </Card>
    </>
  );
}

export const dynamic = "force-dynamic";
