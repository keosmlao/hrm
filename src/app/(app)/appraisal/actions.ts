"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser, hasRole } from "@/lib/auth";
import { gradeOf } from "@/lib/appraisal";

export async function createCycle(_prev: { error?: string }, fd: FormData) {
  await requireRole("ADMIN", "HR");
  const name = String(fd.get("name") ?? "").trim();
  const year = Number(fd.get("year"));
  if (!name || !year) return { error: "ຕ້ອງມີຊື່ຮອບ ແລະ ປີ" };

  const cycle = await prisma.appraisalCycle.create({ data: { name, year } });
  revalidatePath("/appraisal");
  redirect(`/appraisal/${cycle.id}`);
}

/** ສ້າງໃບປະເມີນໃຫ້ພະນັກງານທຸກຄົນທີ່ຍັງບໍ່ມີ (ຜູ້ປະເມີນ = ຫົວໜ້າໂດຍກົງ) */
export async function generateAppraisals(cycleId: string) {
  await requireRole("ADMIN", "HR");
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;

  const [employees, existing] = await Promise.all([
    prisma.employee.findMany({
      where: { employmentStatus: "ACTIVE" },
      select: { code: true, profile: { select: { managerCode: true } } },
    }),
    prisma.appraisal.findMany({ where: { cycleId }, select: { employeeCode: true } }),
  ]);
  const have = new Set(existing.map((a) => a.employeeCode));

  const rows = employees
    .filter((e) => !have.has(e.code))
    .map((e) => ({
      cycleId,
      employeeCode: e.code,
      evaluatorCode: e.profile?.managerCode ?? null,
    }));
  if (rows.length) await prisma.appraisal.createMany({ data: rows });

  revalidatePath(`/appraisal/${cycleId}`);
}

export async function saveAppraisal(id: string, fd: FormData) {
  const session = await requireUser();
  const appraisal = await prisma.appraisal.findUnique({ where: { id } });
  if (!appraisal) return;

  const canEdit =
    hasRole(session, "ADMIN", "HR") || appraisal.evaluatorCode === session.employeeCode;
  if (!canEdit) return;

  const score = Math.max(0, Math.min(100, Number(fd.get("score") ?? 0)));
  await prisma.appraisal.update({
    where: { id },
    data: {
      score,
      grade: gradeOf(score),
      strengths: String(fd.get("strengths") ?? "").trim() || null,
      improvements: String(fd.get("improvements") ?? "").trim() || null,
      comment: String(fd.get("comment") ?? "").trim() || null,
      status: "COMPLETED",
      evaluatedAt: new Date(),
    },
  });

  revalidatePath(`/appraisal/${appraisal.cycleId}`);
  redirect(`/appraisal/${appraisal.cycleId}`);
}

export async function toggleCycle(cycleId: string, isOpen: boolean) {
  await requireRole("ADMIN", "HR");
  await prisma.appraisalCycle.update({ where: { id: cycleId }, data: { isOpen } });
  revalidatePath(`/appraisal/${cycleId}`);
  revalidatePath("/appraisal");
}
