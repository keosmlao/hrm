"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  jobPostingId: z.string().optional(),
  fullname: z.string().min(1, "ກະລຸນາປ້ອນຊື່ ແລະ ນາມສະກຸນ"),
  phone: z.string().min(6, "ກະລຸນາປ້ອນເບີໂທຕິດຕໍ່"),
  email: z.string().email("ອີເມວບໍ່ຖືກຕ້ອງ").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  positionApplied: z.string().optional(),
  education: z.string().optional(),
  experience: z.string().optional(),
  expectedSalary: z.coerce.number().min(0).optional(),
  coverLetter: z.string().optional(),
  resumeUrl: z
    .string()
    .url("ລິ້ງບໍ່ຖືກຕ້ອງ (ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ http)")
    .optional()
    .or(z.literal("")),
  source: z.string().optional(),
});

export type ApplyState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function submitApplication(
  _prev: ApplyState,
  fd: FormData,
): Promise<ApplyState> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (v !== "") raw[k] = v;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues)
      fieldErrors[String(i.path[0])] = i.message;
    return { error: "ຂໍ້ມູນຍັງບໍ່ຄົບຖ້ວນ", fieldErrors };
  }

  const v = parsed.data;

  // ຢືນຢັນວ່າ posting ຍັງເປີດຮັບ (ຖ້າສະໝັກຜ່ານປະກາດ)
  let jobPostingId: string | null = null;
  let positionApplied = v.positionApplied ?? null;
  if (v.jobPostingId) {
    const posting = await prisma.jobPosting.findUnique({
      where: { id: v.jobPostingId },
    });
    if (!posting || posting.status !== "OPEN")
      return { error: "ຕຳແໜ່ງນີ້ປິດຮັບສະໝັກແລ້ວ" };
    jobPostingId = posting.id;
    positionApplied = posting.title;
  }

  const application = await prisma.jobApplication.create({
    data: {
      jobPostingId,
      fullname: v.fullname,
      phone: v.phone,
      email: v.email || null,
      gender: v.gender ?? null,
      dob: v.dob ? new Date(v.dob) : null,
      address: v.address ?? null,
      positionApplied,
      education: v.education ?? null,
      experience: v.experience ?? null,
      expectedSalary: v.expectedSalary ?? null,
      coverLetter: v.coverLetter ?? null,
      resumeUrl: v.resumeUrl || null,
      source: v.source ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "APPLICATION_SUBMITTED",
      entityType: "JobApplication",
      entityId: application.id,
      detail: `ໃບສະໝັກໃໝ່: ${v.fullname}${positionApplied ? ` — ${positionApplied}` : ""}`,
    },
  });

  redirect("/careers/thank-you");
}
