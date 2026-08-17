"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

// ─────────────────────────────────────────────
// ປະກາດຮັບສະໝັກ (JobPosting)
// ─────────────────────────────────────────────

const postingSchema = z.object({
  title: z.string().min(1, "ຕ້ອງມີຊື່ຕຳແໜ່ງ"),
  departmentCode: z.string().optional(),
  positionCode: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]),
  location: z.string().optional(),
  openings: z.coerce.number().int().min(1),
  salaryRange: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]),
  closingDate: z.string().optional(),
});

function parsePosting(fd: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (v !== "") raw[k] = v;
  return postingSchema.safeParse(raw);
}

function fieldErrors(issues: z.ZodIssue[]) {
  const e: Record<string, string> = {};
  for (const i of issues) e[String(i.path[0])] = i.message;
  return e;
}

/** ສ້າງ slug ຈາກຊື່ຕຳແໜ່ງ + suffix ໃຫ້ບໍ່ຊ້ຳ */
function slugify(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[\s/\\?#%]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = Date.now().toString(36).slice(-4);
  return `${base || "job"}-${suffix}`;
}

type PostingValues = z.infer<typeof postingSchema>;

function postingData(v: PostingValues) {
  return {
    title: v.title,
    departmentCode: v.departmentCode ?? null,
    positionCode: v.positionCode ?? null,
    employmentType: v.employmentType,
    location: v.location ?? null,
    openings: v.openings,
    salaryRange: v.salaryRange ?? null,
    description: v.description ?? null,
    requirements: v.requirements ?? null,
    status: v.status,
    closingDate: v.closingDate ? new Date(v.closingDate) : null,
  };
}

export async function createPosting(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = parsePosting(fd);
  if (!parsed.success)
    return { error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ", fieldErrors: fieldErrors(parsed.error.issues) };

  const posting = await prisma.jobPosting.create({
    data: {
      ...postingData(parsed.data),
      slug: slugify(parsed.data.title),
      postedByUserId: session.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "CREATE",
      entityType: "JobPosting",
      entityId: posting.id,
      detail: `ສ້າງປະກາດຮັບສະໝັກ: ${posting.title}`,
    },
  });

  revalidatePath("/recruitment/postings");
  redirect("/recruitment/postings");
}

export async function updatePosting(
  id: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = parsePosting(fd);
  if (!parsed.success)
    return { error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ", fieldErrors: fieldErrors(parsed.error.issues) };

  const before = await prisma.jobPosting.findUnique({ where: { id } });
  if (!before) return { error: "ບໍ່ພົບປະກາດ" };

  await prisma.jobPosting.update({
    where: { id },
    data: postingData(parsed.data),
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "JobPosting",
      entityId: id,
      detail: `ແກ້ໄຂປະກາດຮັບສະໝັກ: ${parsed.data.title}`,
    },
  });

  revalidatePath("/recruitment/postings");
  revalidatePath(`/careers/${before.slug}`);
  redirect("/recruitment/postings");
}

// ─────────────────────────────────────────────
// ໃບສະໝັກ (JobApplication)
// ─────────────────────────────────────────────

const statusSchema = z.object({
  status: z.enum([
    "NEW",
    "SCREENING",
    "INTERVIEW",
    "OFFERED",
    "HIRED",
    "REJECTED",
  ]),
  note: z.string().optional(),
});

export async function updateApplication(
  id: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = statusSchema.safeParse({
    status: fd.get("status"),
    note: fd.get("note") || undefined,
  });
  if (!parsed.success)
    return { error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ", fieldErrors: fieldErrors(parsed.error.issues) };

  const before = await prisma.jobApplication.findUnique({ where: { id } });
  if (!before) return { error: "ບໍ່ພົບໃບສະໝັກ" };

  await prisma.jobApplication.update({
    where: { id },
    data: { status: parsed.data.status, note: parsed.data.note ?? null },
  });

  if (before.status !== parsed.data.status) {
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE_STATUS",
        entityType: "JobApplication",
        entityId: id,
        detail: `ໃບສະໝັກ ${before.fullname}: ${before.status} → ${parsed.data.status}`,
      },
    });
  }

  revalidatePath("/recruitment");
  revalidatePath(`/recruitment/applications/${id}`);
  return {};
}
