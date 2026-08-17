import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LeaveForm } from "../leave-form";

export const dynamic = "force-dynamic";

export default async function NewLeavePage() {
  await requireUser();
  const types = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true, requiresProof: true },
  });

  return (
    <>
      <PageHeader title="ຂໍລາພັກ" subtitle="ກรອກຄຳຂໍ ແລ້ວສົ່ງໃຫ້ຫົວໜ້າ / HR ອະນຸມັດ" />
      <LeaveForm types={types} />
    </>
  );
}
