import "server-only";
import { prisma } from "./prisma";
import type { SessionPayload } from "./jwt";

export const APPROVER_TYPE_LABEL: Record<string, string> = {
  UNIT_HEAD: "ຫົວໜ້າໜ່ວຍງານ",
  DEPT_HEAD: "ຜູ້ຈັດການພະແນກ",
  DIVISION_HEAD: "ຫົວໜ້າຝ່າຍ",
  SPECIFIC: "ຄົນສະເພາະ",
};
export const APPROVER_TYPES = ["UNIT_HEAD", "DEPT_HEAD", "DIVISION_HEAD", "SPECIFIC"] as const;

type Step = { approverType: string; specificEmployeeCode: string | null };

export function getApprovalSteps() {
  return prisma.tripApprovalStep.findMany({ orderBy: { stepOrder: "asc" } });
}

/** ລະຫັດຜູ້ອະນຸມັດ ຂອງ step ໜຶ່ງ ສຳລັບຄຳຮ້ອງຂອງ requester (resolve ຈາກ OrgHead ຫຼື ຄົນສະເພາະ) */
export async function resolveStepApprovers(step: Step, requesterCode: string): Promise<Set<string>> {
  if (step.approverType === "SPECIFIC") {
    return step.specificEmployeeCode ? new Set([step.specificEmployeeCode]) : new Set();
  }
  const emp = await prisma.employee.findUnique({
    where: { code: requesterCode },
    select: { unitCode: true, departmentCode: true, divisionCode: true },
  });
  if (!emp) return new Set();
  const target: Record<string, { scope: "UNIT" | "DEPARTMENT" | "DIVISION"; code: string | null }> = {
    UNIT_HEAD: { scope: "UNIT", code: emp.unitCode },
    DEPT_HEAD: { scope: "DEPARTMENT", code: emp.departmentCode },
    DIVISION_HEAD: { scope: "DIVISION", code: emp.divisionCode },
  };
  const t = target[step.approverType];
  if (!t || !t.code) return new Set();
  const heads = await prisma.orgHead.findMany({ where: { scope: t.scope, code: t.code }, select: { employeeCode: true } });
  return new Set(heads.map((h) => h.employeeCode));
}

/** ຂໍ້ມູນຂັ້ນປັດຈຸບັນ + ຜູ້ອະນຸມັດທີ່ຄາດໄວ້ */
export async function currentStepInfo(trip: { requestedByCode: string | null; approvalLevel: number }) {
  const steps = await getApprovalSteps();
  const totalSteps = steps.length;
  const done = trip.approvalLevel >= totalSteps;
  const currentStep = done ? null : steps[trip.approvalLevel];
  const approvers = currentStep && trip.requestedByCode ? await resolveStepApprovers(currentStep, trip.requestedByCode) : new Set<string>();
  return { steps, totalSteps, done, currentStep, approvers };
}

/** ຜູ້ໃຊ້ອະນຸມັດຂັ້ນປັດຈຸບັນໄດ້ບໍ (ADMIN/HR/EXECUTIVE = super-approver ຂ້າມຂັ້ນ) */
export function canApproveStep(session: SessionPayload, approvers: Set<string>): boolean {
  if (["ADMIN", "HR", "EXECUTIVE"].includes(session.role)) return true;
  return !!session.employeeCode && approvers.has(session.employeeCode);
}

export async function canApproveCurrentStep(session: SessionPayload, trip: { requestedByCode: string | null; approvalLevel: number }): Promise<boolean> {
  const { done, approvers } = await currentStepInfo(trip);
  if (done) return false;
  return canApproveStep(session, approvers);
}
