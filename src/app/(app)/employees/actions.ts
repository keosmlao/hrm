"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { laoWorkDate } from "@/lib/attendance";

const schema = z.object({
  code: z.string().min(1, "ຕ້ອງມີລະຫັດພະນັກງານ"),
  titleLo: z.string().optional(),
  fullnameLo: z.string().min(1, "ຕ້ອງມີຊື່ ແລະ ນາມສະກຸນ"),
  fullnameEn: z.string().optional(),
  nickname: z.string().optional(),
  mobile: z.string().optional(),
  hireDate: z.string().min(1, "ຕ້ອງມີວັນເລີ່ມວຽກ"),
  divisionCode: z.string().optional(),
  departmentCode: z.string().min(1, "ຕ້ອງເລືອກພະແນກ"),
  unitCode: z.string().optional(),
  positionCode: z.string().min(1, "ຕ້ອງເລືອກຕຳແໜ່ງ"),

  // ─ hrm_employee_profile ─
  hrStatus: z.enum([
    "PROBATION",
    "ACTIVE",
    "ON_LEAVE",
    "SUSPENDED",
    "RESIGNED",
    "TERMINATED",
  ]),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dob: z.string().optional(),
  nationalId: z.string().optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  probationEndDate: z.string().optional(),
  managerCode: z.string().optional(),
  baseSalary: z.coerce.number().min(0),
  positionAllowance: z.coerce.number().min(0),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  socialSecurityNo: z.string().optional(),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function parse(fd: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (v !== "") raw[k] = v;
  return schema.safeParse(raw);
}

type Values = z.infer<typeof schema>;

function employeeData(v: Values) {
  return {
    titleLo: v.titleLo ?? null,
    fullnameLo: v.fullnameLo,
    fullnameEn: v.fullnameEn ?? null,
    nickname: v.nickname ?? null,
    mobile: v.mobile ?? null,
    hireDate: new Date(v.hireDate),
    divisionCode: v.divisionCode ?? null,
    departmentCode: v.departmentCode,
    unitCode: v.unitCode ?? null,
    positionCode: v.positionCode,
  };
}

function profileData(v: Values) {
  return {
    hrStatus: v.hrStatus,
    gender: v.gender ?? null,
    dob: v.dob ? new Date(v.dob) : null,
    nationalId: v.nationalId ?? null,
    maritalStatus: v.maritalStatus ?? null,
    email: v.email ?? null,
    address: v.address ?? null,
    probationEndDate: v.probationEndDate ? new Date(v.probationEndDate) : null,
    managerCode: v.managerCode ?? null,
    baseSalary: v.baseSalary,
    positionAllowance: v.positionAllowance,
    bankName: v.bankName ?? null,
    bankAccountNo: v.bankAccountNo ?? null,
    socialSecurityNo: v.socialSecurityNo ?? null,
  };
}

function fieldErrors(issues: z.ZodIssue[]) {
  const e: Record<string, string> = {};
  for (const i of issues) e[String(i.path[0])] = i.message;
  return e;
}

export async function createEmployee(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = parse(fd);
  if (!parsed.success)
    return { error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ", fieldErrors: fieldErrors(parsed.error.issues) };

  const v = parsed.data;
  if (await prisma.employee.findUnique({ where: { code: v.code } }))
    return { error: "ລະຫັດພະນັກງານນີ້ມີຢູ່ແລ້ວ" };

  await prisma.employee.create({
    data: {
      code: v.code,
      employmentStatus: "ACTIVE",
      ...employeeData(v),
      profile: { create: profileData(v) },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "CREATE",
      entityType: "Employee",
      entityId: v.code,
      detail: `ສ້າງພະນັກງານ ${v.code} — ${v.fullnameLo}`,
    },
  });

  revalidatePath("/employees");
  redirect(`/employees/${v.code}`);
}

export async function updateEmployee(
  code: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = parse(fd);
  if (!parsed.success)
    return { error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ", fieldErrors: fieldErrors(parsed.error.issues) };

  const v = parsed.data;
  const before = await prisma.employee.findUnique({
    where: { code },
    include: { profile: true },
  });
  if (!before) return { error: "ບໍ່ພົບພະນັກງານ" };

  await prisma.employee.update({
    where: { code },
    data: employeeData(v),
  });

  await prisma.employeeProfile.upsert({
    where: { employeeCode: code },
    update: profileData(v),
    create: { employeeCode: code, ...profileData(v) },
  });

  // ບັນທຶກປະຫວັດການປ່ຽນແປງທີ່ສຳຄັນ
  const movements: {
    type: "PROMOTION" | "TRANSFER_DEPT" | "TRANSFER_UNIT" | "SALARY_ADJUST" | "STATUS_CHANGE";
    fromPositionCode?: string | null;
    toPositionCode?: string | null;
    fromDepartmentCode?: string | null;
    toDepartmentCode?: string | null;
    fromUnitCode?: string | null;
    toUnitCode?: string | null;
    fromSalary?: number | null;
    toSalary?: number | null;
    fromStatus?: (typeof v)["hrStatus"] | null;
    toStatus?: (typeof v)["hrStatus"] | null;
  }[] = [];

  if (before.positionCode !== v.positionCode)
    movements.push({
      type: "PROMOTION",
      fromPositionCode: before.positionCode,
      toPositionCode: v.positionCode,
    });
  if (before.departmentCode !== v.departmentCode)
    movements.push({
      type: "TRANSFER_DEPT",
      fromDepartmentCode: before.departmentCode,
      toDepartmentCode: v.departmentCode,
    });
  if ((before.unitCode ?? null) !== (v.unitCode ?? null))
    movements.push({
      type: "TRANSFER_UNIT",
      fromUnitCode: before.unitCode,
      toUnitCode: v.unitCode ?? null,
    });
  if (before.profile && Number(before.profile.baseSalary) !== v.baseSalary)
    movements.push({
      type: "SALARY_ADJUST",
      fromSalary: Number(before.profile.baseSalary),
      toSalary: v.baseSalary,
    });
  if (before.profile && before.profile.hrStatus !== v.hrStatus)
    movements.push({
      type: "STATUS_CHANGE",
      fromStatus: before.profile.hrStatus,
      toStatus: v.hrStatus,
    });

  if (movements.length > 0) {
    await prisma.employeeMovement.createMany({
      data: movements.map((m) => ({
        ...m,
        employeeCode: code,
        effectiveDate: new Date(),
        approvedByUserId: session.userId,
      })),
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "Employee",
      entityId: code,
      detail: `ແກ້ໄຂຂໍ້ມູນພະນັກງານ ${code}`,
    },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${code}`);
  redirect(`/employees/${code}`);
}

export type RecordFormState = { error?: string; success?: string };

const contractSchema = z.object({
  contractNo: z.string().trim().min(1).max(100),
  type: z.enum(["PROBATION", "FIXED_TERM", "PERMANENT", "PART_TIME", "INTERNSHIP"]),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  salary: z.coerce.number().min(0),
  fileUrl: z.string().trim().url().optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional(),
});

export async function createContract(
  employeeCode: string,
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = contractSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ກະລຸນາກວດເລກສັນຍາ, ວັນທີ ແລະ ເງິນເດືອນ" };
  const value = parsed.data;
  if (value.endDate && value.endDate < value.startDate) return { error: "ວັນສິ້ນສຸດຕ້ອງຫຼັງວັນເລີ່ມ" };
  if (await prisma.contract.findUnique({ where: { contractNo: value.contractNo } })) {
    return { error: "ເລກສັນຍານີ້ມີແລ້ວ" };
  }

  const contract = await prisma.contract.create({
    data: {
      employeeCode,
      contractNo: value.contractNo,
      type: value.type,
      startDate: new Date(`${value.startDate}T00:00:00Z`),
      endDate: value.endDate ? new Date(`${value.endDate}T00:00:00Z`) : null,
      salary: value.salary,
      fileUrl: value.fileUrl || null,
      note: value.note || null,
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CREATE", entityType: "Contract", entityId: contract.id, detail: `${employeeCode} · ${contract.contractNo}` },
  });
  revalidatePath(`/employees/${employeeCode}`);
  return { success: "ເພີ່ມສັນຍາແລ້ວ" };
}

export async function setContractActive(contractId: string, active: boolean) {
  const session = await requireRole("ADMIN", "HR");
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return;
  await prisma.contract.update({ where: { id: contractId }, data: { isActive: active } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: active ? "ACTIVATE" : "CLOSE", entityType: "Contract", entityId: contractId, detail: contract.contractNo },
  });
  revalidatePath(`/employees/${contract.employeeCode}`);
  revalidatePath("/dashboard");
}

const documentSchema = z.object({
  name: z.string().trim().min(1).max(150),
  type: z.string().trim().max(100).optional(),
  fileUrl: z.string().trim().url(),
  expiryDate: z.string().optional(),
});

export async function createEmployeeDocument(
  employeeCode: string,
  _previous: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const session = await requireRole("ADMIN", "HR");
  const parsed = documentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "ຕ້ອງມີຊື່ເອກະສານ ແລະ URL ທີ່ຖືກຕ້ອງ" };
  const value = parsed.data;
  const document = await prisma.employeeDocument.create({
    data: {
      employeeCode,
      name: value.name,
      type: value.type || null,
      fileUrl: value.fileUrl,
      expiryDate: value.expiryDate ? new Date(`${value.expiryDate}T00:00:00Z`) : null,
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CREATE", entityType: "EmployeeDocument", entityId: document.id, detail: `${employeeCode} · ${document.name}` },
  });
  revalidatePath(`/employees/${employeeCode}`);
  return { success: "ເພີ່ມເອກະສານແລ້ວ" };
}

export async function deleteEmployeeDocument(documentId: string) {
  const session = await requireRole("ADMIN", "HR");
  const document = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
  if (!document) return;
  await prisma.employeeDocument.delete({ where: { id: documentId } });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "DELETE", entityType: "EmployeeDocument", entityId: documentId, detail: `${document.employeeCode} · ${document.name}` },
  });
  revalidatePath(`/employees/${document.employeeCode}`);
}

/**
 * ກຳນົດ "ກະເຮັດວຽກ" ໃຫ້ພະນັກງານ (ຄ່າວ່າງ = ໃຊ້ຄ່າເລີ່ມຕົ້ນ 08:00–17:00)
 * ປິດ assignment ເກົ່າທີ່ຍັງເປີດ ແລ້ວເປີດອັນໃໝ່ຕັ້ງແຕ່ວັນທີ່ກຳນົດ
 */
export async function assignShift(employeeCode: string, fd: FormData) {
  const session = await requireRole("ADMIN", "HR");
  const shiftId = String(fd.get("shiftId") ?? "");
  const note = String(fd.get("note") ?? "").trim() || null;
  const fromStr = String(fd.get("effectiveFrom") ?? "");
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromStr)
    ? new Date(`${fromStr}T00:00:00Z`)
    : laoWorkDate(new Date());

  if (!shiftId) {
    // ປິດ (ບໍ່ລຶບ) assignment ທີ່ຍັງເປີດ ເພື່ອຮັກສາປະຫວັດ → ກັບໄປໃຊ້ຄ່າເລີ່ມຕົ້ນ
    const dayBefore = new Date(from);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    await prisma.employeeShiftAssignment.updateMany({
      where: { employeeCode, effectiveTo: null },
      data: { effectiveTo: dayBefore },
    });
  } else {
    const dayBefore = new Date(from);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    await prisma.$transaction([
      prisma.employeeShiftAssignment.updateMany({
        where: { employeeCode, effectiveTo: null, effectiveFrom: { lt: from } },
        data: { effectiveTo: dayBefore },
      }),
      prisma.employeeShiftAssignment.upsert({
        where: { employeeCode_effectiveFrom: { employeeCode, effectiveFrom: from } },
        update: { shiftId, effectiveTo: null, note },
        create: { employeeCode, shiftId, effectiveFrom: from, note },
      }),
    ]);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "EmployeeShiftAssignment",
      entityId: employeeCode,
      detail: shiftId ? `ກຳນົດກະ (shift ${shiftId})` : "ໃຊ້ຄ່າເລີ່ມຕົ້ນ",
    },
  });
  revalidatePath(`/employees/${employeeCode}`);
  revalidatePath("/attendance");
}

// ── ລາອອກ / ເລີກຈ້າງ ─────────────────────────────────────────────────────

export type ResignState = { ok: true; message: string } | { ok: false; error: string };

const RESIGN_STATUS = ["RESIGNED", "TERMINATED"] as const;
type ResignStatus = (typeof RESIGN_STATUS)[number];

/**
 * ວຽກທີ່ຄ້າງຢູ່ຂອງພະນັກງານ — ໃຫ້ HR ເຫັນກ່ອນຢືນຢັນລາອອກ.
 * ບໍ່ຂັດການລາອອກ ພຽງແຕ່ເຕືອນ (ບາງເທື່ອຄົນອອກໄປແລ້ວແທ້ໆ ຕ້ອງບັນທຶກຍ້ອນຫຼັງ).
 */
export async function pendingBeforeResign(code: string) {
  const [assets, trips, leaves, ots, corrections, isApprover] = await Promise.all([
    prisma.assetAssignment.count({ where: { employeeCode: code, returnedDate: null } }),
    prisma.vehicleTrip.count({
      where: {
        status: { notIn: ["RETURNED", "CANCELLED"] },
        OR: [{ driverCode: code }, { members: { some: { employeeCode: code } } }],
      },
    }),
    prisma.leaveRequest.count({ where: { employeeCode: code, status: { in: ["PENDING_MANAGER", "PENDING_HR"] } } }),
    prisma.overtimeRequest.count({ where: { employeeCode: code, status: { in: ["PENDING_MANAGER", "PENDING_HR"] } } }),
    prisma.attendanceCorrectionRequest.count({ where: { employeeCode: code, status: "PENDING" } }),
    prisma.vehicleApprover.count({ where: { employeeCode: code } }),
  ]);
  return { assets, trips, leaves, ots, corrections, isApprover: isApprover > 0 };
}

/**
 * ບັນທຶກການລາອອກ / ເລີກຈ້າງ — ຂັ້ນຕອນດຽວຄົບທຸກບ່ອນທີ່ສະຖານະມີຜົນ:
 *   1. `odg_employee.employment_status` (HRM ເປັນເຈົ້າຂອງຕາຕະລາງນີ້)
 *   2. `hrm_employee_profile.hr_status` + `resign_date` (upsert — ພະນັກງານ
 *      ສ່ວນໃຫຍ່ຍັງບໍ່ມີ profile ຈຶ່ງຕ້ອງສ້າງໃຫ້)
 *   3. ປິດບັນຊີ login ຖ້າມີ
 *   4. ບັນທຶກ `EmployeeMovement` + `AuditLog` ໄວ້ເປັນປະຫວັດ
 *
 * ທັງໝົດຢູ່ໃນ transaction ດຽວ — ບໍ່ໃຫ້ເຫຼືອສະຖານະຄາເຄິ່ງ.
 */
export async function resignEmployee(form: FormData): Promise<ResignState> {
  const session = await requireRole("ADMIN", "HR");

  const code = String(form.get("code") ?? "").trim();
  const status = String(form.get("status") ?? "") as ResignStatus;
  const effective = String(form.get("effectiveDate") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();

  if (!code) return { ok: false, error: "ບໍ່ພົບລະຫັດພະນັກງານ" };
  if (!RESIGN_STATUS.includes(status)) return { ok: false, error: "ເລືອກປະເພດການອອກ" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effective)) return { ok: false, error: "ໃສ່ວັນທີ່ມີຜົນ" };
  if (!reason) return { ok: false, error: "ໃສ່ເຫດຜົນ" };

  const employee = await prisma.employee.findUnique({
    where: { code },
    select: { code: true, employmentStatus: true, profile: { select: { hrStatus: true } }, user: { select: { id: true } } },
  });
  if (!employee) return { ok: false, error: "ບໍ່ພົບພະນັກງານ" };
  // ບລັອກສະເພາະເມື່ອ**ຄົບທຸກບ່ອນແລ້ວ** — ຂໍ້ມູນເກົ່າມີກໍລະນີ hr_status ເປັນ
  // RESIGNED ແຕ່ employment_status ຍັງ ACTIVE (ຕັ້ງຜ່ານຟອມແກ້ໄຂເກົ່າ) ເຊິ່ງ
  // ຕ້ອງອະນຸຍາດໃຫ້ບັນທຶກຊ້ຳເພື່ອສ້ອມໃຫ້ຕົງກັນ ແລະ ໃສ່ວັນທີ່ມີຜົນ
  const alreadyDone =
    employee.employmentStatus === status && employee.profile?.hrStatus === status;
  if (alreadyDone) return { ok: false, error: "ພະນັກງານຄົນນີ້ບັນທຶກຄົບແລ້ວ" };

  const effectiveDate = new Date(`${effective}T00:00:00Z`);

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { code }, data: { employmentStatus: status } });

    await tx.employeeProfile.upsert({
      where: { employeeCode: code },
      create: { employeeCode: code, hrStatus: status, resignDate: effectiveDate },
      update: { hrStatus: status, resignDate: effectiveDate },
    });

    if (employee.user) {
      await tx.user.update({ where: { id: employee.user.id }, data: { isActive: false } });
    }

    await tx.employeeMovement.create({
      data: {
        type: "STATUS_CHANGE",
        employeeCode: code,
        effectiveDate,
        fromStatus: employee.profile?.hrStatus ?? null,
        toStatus: status,
        reason,
        approvedByUserId: session.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.userId,
        action: status === "RESIGNED" ? "RESIGN" : "TERMINATE",
        entityType: "Employee",
        entityId: code,
        detail: JSON.stringify({ status, effective, reason, userDisabled: Boolean(employee.user) }),
      },
    });
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${code}`);
  return {
    ok: true,
    message: employee.user
      ? "ບັນທຶກແລ້ວ · ປິດບັນຊີເຂົ້າລະບົບໃຫ້ນຳ"
      : "ບັນທຶກແລ້ວ",
  };
}

/** ຮັບກັບເຂົ້າເຮັດວຽກ — ຄືນສະຖານະເປັນ ACTIVE ພ້ອມບັນທຶກປະຫວັດ */
export async function reinstateEmployee(form: FormData): Promise<ResignState> {
  const session = await requireRole("ADMIN", "HR");
  const code = String(form.get("code") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim() || "ຮັບກັບເຂົ້າເຮັດວຽກ";
  if (!code) return { ok: false, error: "ບໍ່ພົບລະຫັດພະນັກງານ" };

  const employee = await prisma.employee.findUnique({
    where: { code },
    select: { profile: { select: { hrStatus: true } }, user: { select: { id: true } } },
  });
  if (!employee) return { ok: false, error: "ບໍ່ພົບພະນັກງານ" };

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { code }, data: { employmentStatus: "ACTIVE" } });
    await tx.employeeProfile.upsert({
      where: { employeeCode: code },
      create: { employeeCode: code, hrStatus: "ACTIVE" },
      update: { hrStatus: "ACTIVE", resignDate: null },
    });
    if (employee.user) {
      await tx.user.update({ where: { id: employee.user.id }, data: { isActive: true } });
    }
    await tx.employeeMovement.create({
      data: {
        type: "STATUS_CHANGE",
        employeeCode: code,
        effectiveDate: new Date(),
        fromStatus: employee.profile?.hrStatus ?? null,
        toStatus: "ACTIVE",
        reason,
        approvedByUserId: session.userId,
      },
    });
    await tx.auditLog.create({
      data: { userId: session.userId, action: "REINSTATE", entityType: "Employee", entityId: code, detail: reason },
    });
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${code}`);
  return { ok: true, message: "ຮັບກັບເຂົ້າເຮັດວຽກແລ້ວ" };
}
