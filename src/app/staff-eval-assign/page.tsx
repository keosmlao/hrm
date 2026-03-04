import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AppLogo from "@/components/app-logo";
import AssignForm from "./assign-form";

interface SessionData {
  lineUserId: string;
  employee: {
    employeeCode: string;
    positionCode: string;
    departmentCode: string;
    unitCode: string;
  } | null;
}

async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session) return null;
  try {
    return JSON.parse(Buffer.from(session.value, "base64").toString());
  } catch {
    return null;
  }
}

export default async function StaffEvalAssignPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const emp =
    session.employee
      ? {
          employee_code: session.employee.employeeCode,
          position_code: session.employee.positionCode,
          department_code: session.employee.departmentCode,
          unit_code: session.employee.unitCode,
        }
      : await prisma.odg_employee.findFirst({
          where: { line_id: session.lineUserId },
          select: {
            employee_code: true,
            position_code: true,
            department_code: true,
            unit_code: true,
          },
        });

  if (!emp) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
            <p className="text-brand-500">ບໍ່ພົບຂໍ້ມູນພະນັກງານ</p>
          </div>
        </main>
      </div>
    );
  }

  const isManager = ["11", "12"].includes(emp.position_code ?? "");

  if (!isManager) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
        <Nav />
        <main className="mx-auto max-w-3xl px-6 py-8">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
            <p className="text-brand-500">ສະເພາະຫົວໜ້າ ແລະ ຜູ້ຈັດການ ເທົ່ານັ້ນ</p>
            <Link href="/home" className="mt-4 inline-block text-sm text-brand-700 underline">
              ກັບໜ້າຫຼັກ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const year = String(new Date().getFullYear());

  // ລາຍຊື່ທີ່ assign ແລ້ວ
  const posCode = emp.position_code;

  const assignmentRows = await prisma.odg_staff_eval_assignment.findMany({
    where: { evaluator_code: emp.employee_code, year },
    orderBy: { id: 'asc' },
  });
  const assignedCodes = assignmentRows.map(a => a.target_code);
  const posNotIn = posCode === '11' ? ['11'] : ['11', '12'];
  const [assignedEmps, candidateRows] = await Promise.all([
    assignedCodes.length > 0
      ? prisma.odg_employee.findMany({
          where: { employee_code: { in: assignedCodes } },
          include: { odg_position_rel: true, odg_department_rel: true },
        })
      : Promise.resolve([]),
    prisma.odg_employee.findMany({
      where: {
        employee_code: { not: emp.employee_code, notIn: assignedCodes },
        employment_status: 'ACTIVE',
        position_code: { notIn: posNotIn },
      },
      include: { odg_position_rel: true, odg_department_rel: true },
      orderBy: [{ position_code: 'asc' }, { fullname_lo: 'asc' }],
    }),
  ]);
  const empMap = new Map(assignedEmps.map(e => [e.employee_code, e]));
  const assigned = assignmentRows.map(a => {
    const e = empMap.get(a.target_code);
    return {
      id: a.id,
      target_code: a.target_code,
      fullname_lo: e?.fullname_lo ?? null,
      position_code: e?.position_code ?? null,
      position_name_lo: e?.odg_position_rel?.position_name_lo ?? null,
      department_code: e?.department_code ?? null,
      department_name_lo: e?.odg_department_rel?.department_name_lo ?? null,
    };
  });
  const candidates = candidateRows.map(e => ({
    employee_code: e.employee_code,
    fullname_lo: e.fullname_lo,
    position_code: e.position_code,
    position_name_lo: e.odg_position_rel?.position_name_lo ?? null,
    department_code: e.department_code,
    department_name_lo: e.odg_department_rel?.department_name_lo ?? null,
  }));

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <AssignForm
          assigned={assigned}
          candidates={candidates}
        />
      </main>
    </div>
  );
}

function Nav() {
  return (
    <nav className="bg-brand-700 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <AppLogo className="shrink-0" />
          <h1 className="text-lg font-bold leading-tight text-white sm:text-xl">
            ຕັ້ງຄ່າຜູ້ຖືກປະເມີນເພີ່ມເຕີມ
          </h1>
        </div>
        <Link
          href="/home"
          className="self-stretch rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-white/20 sm:self-auto"
        >
          ກັບໜ້າຫຼັກ
        </Link>
      </div>
    </nav>
  );
}
