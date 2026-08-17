"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { monthRange } from "@/lib/attendance";
import type { Prisma } from "@/generated/prisma/client";

export type RosterFormState = { error?: string; success?: string };

const rosterSchema = z.object({
  employeeCode: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function saveMonthlyRoster(
  _previous: RosterFormState,
  formData: FormData,
): Promise<RosterFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = rosterSchema.safeParse({
    employeeCode: formData.get("employeeCode"),
    month: formData.get("month"),
  });
  if (!parsed.success) return { error: "ກະລຸນາເລືອກພະນັກງານ ແລະ ເດືອນ" };
  const { employeeCode, month } = parsed.data;
  const { start, end } = monthRange(month);
  const selected = [...new Set(formData.getAll("dayOff").map(String))];
  if (selected.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(`${month}-`))) {
    return { error: "ພົບວັນທີບໍ່ຖືກຕ້ອງ" };
  }

  await prisma.$transaction([
    prisma.employeeDayOff.deleteMany({
      where: { employeeCode, date: { gte: start, lte: end } },
    }),
    ...(selected.length
      ? [
          prisma.employeeDayOff.createMany({
            data: selected.map((date) => ({
              employeeCode,
              date: new Date(`${date}T00:00:00Z`),
              createdByUserId: session.userId,
            })),
          }),
        ]
      : []),
  ]);
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "EmployeeDayOffRoster",
      entityId: `${employeeCode}:${month}`,
      detail: `${selected.length} ວັນພັກ`,
    },
  });
  revalidatePath("/attendance/roster");
  revalidatePath("/attendance");
  return { success: `ບັນທຶກວັນພັກ ${selected.length} ວັນແລ້ວ` };
}

/** ບັນທຶກຕາຕະລາງລວມ (ຫຼາຍຄົນພ້ອມກັນ) — entries = ທຸກຄົນທີ່ສະແດງ + ວັນພັກຂອງເຂົາ */
export async function saveRosterGrid(
  month: string,
  entries: { employeeCode: string; dates: string[] }[],
): Promise<RosterFormState> {
  const session = await requireRole("ADMIN", "HR");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "ເດືອນບໍ່ຖືກຕ້ອງ" };
  const { start, end } = monthRange(month);
  const codes = [...new Set(entries.map((e) => e.employeeCode))];
  if (codes.length === 0) return { error: "ບໍ່ມີພະນັກງານ" };

  const createData = entries.flatMap((entry) =>
    [...new Set(entry.dates)]
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(`${month}-`))
      .map((date) => ({
        employeeCode: entry.employeeCode,
        date: new Date(`${date}T00:00:00Z`),
        createdByUserId: session.userId,
      })),
  );

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.employeeDayOff.deleteMany({
      where: { employeeCode: { in: codes }, date: { gte: start, lte: end } },
    }),
  ];
  if (createData.length) {
    ops.push(prisma.employeeDayOff.createMany({ data: createData }));
  }
  await prisma.$transaction(ops);

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "EmployeeDayOffRoster",
      entityId: `grid:${month}`,
      detail: `ຕາຕະລາງລວມ ${codes.length} ຄົນ · ${createData.length} ວັນພັກ`,
    },
  });
  revalidatePath("/attendance/roster");
  revalidatePath("/attendance");
  return { success: `ບັນທຶກແລ້ວ — ${codes.length} ຄົນ, ${createData.length} ວັນພັກ` };
}
