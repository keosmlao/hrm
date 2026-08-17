import "server-only";
import { prisma } from "./prisma";
import { getSession } from "./session";
import { verifyLineIdToken, employeeByLineId } from "./line";
import type { Role } from "./jwt";
import { ACTIVE_EMPLOYEE } from "./employee-status";

/** ຫາພະນັກງານ ACTIVE ຕາມລະຫັດ (ໃຊ້ໂດຍ web portal ທີ່ login ດ້ວຍ session) */
export function employeeByCode(code: string) {
  return prisma.employee.findFirst({
    where: { code, ...ACTIVE_EMPLOYEE },
  });
}

type Employee = NonNullable<Awaited<ReturnType<typeof employeeByCode>>>;

export type ResolvedEmployee =
  | { kind: "employee"; employee: Employee; actorUserId: string; actorRole: Role | "EMPLOYEE" }
  | { kind: "unlinked"; lineName: string | null }
  | { kind: "unauthenticated" };

/**
 * ຢືນຢັນຕົວຕົນຂອງພະນັກງານຈາກ 2 ຊ່ອງທາງ:
 *  - LINE mini-app → ສົ່ງ idToken ມາ → verify + ຫາຕາມ line_id ໃນ odg_employee
 *  - Web portal   → ບໍ່ມີ idToken → ໃຊ້ session (cookie) → ຫາຕາມ employeeCode
 */
export async function getRequestEmployee(idToken?: string | null): Promise<ResolvedEmployee> {
  if (idToken) {
    const identity = await verifyLineIdToken(idToken);
    if (!identity) return { kind: "unauthenticated" };
    const employee = await employeeByLineId(identity.sub);
    if (!employee) return { kind: "unlinked", lineName: identity.name ?? null };
    return { kind: "employee", employee, actorUserId: `LINE:${identity.sub}`, actorRole: "EMPLOYEE" };
  }

  const session = await getSession();
  if (!session?.employeeCode) return { kind: "unauthenticated" };
  const employee = await employeeByCode(session.employeeCode);
  if (!employee) return { kind: "unlinked", lineName: null };
  return { kind: "employee", employee, actorUserId: `USER:${session.userId}`, actorRole: session.role };
}
