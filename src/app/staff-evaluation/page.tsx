import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AppLogo from "@/components/app-logo";
import StaffEvalForm from "./staff-eval-form";

const MONTH_NAMES = [
  "", "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeCode: string;
    fullnameLo: string;
    positionCode: string;
    unitCode: string;
    departmentCode: string;
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

/** ຄຳນວນເດືອນກ່ອນໜ້າ */
function getPreviousMonth(): { year: string; month: number } {
  const now = new Date();
  let m = now.getMonth(); // 0-indexed
  const y = now.getFullYear();
  if (m === 0) {
    return { year: String(y - 1), month: 12 };
  }
  return { year: String(y), month: m };
}

export default async function StaffEvaluationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const emp =
    session.employee
      ? {
          employee_code: session.employee.employeeCode,
          fullname_lo: session.employee.fullnameLo,
          position_code: session.employee.positionCode,
          unit_code: session.employee.unitCode,
          department_code: session.employee.departmentCode,
        }
      : await prisma.odg_employee.findFirst({
          where: { line_id: session.lineUserId },
          select: { employee_code: true, fullname_lo: true, position_code: true, unit_code: true, department_code: true },
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

  const prev = getPreviousMonth();
  const year = prev.year;
  const month = prev.month;
  const isManager = ["11", "12"].includes(emp.position_code ?? "");

  const [criteria, selfAllResult, selfEval, evals] = await Promise.all([
    prisma.odg_staff_eval_criteria.findMany({
      orderBy: [{ question_order: 'asc' }, { option_id: 'asc' }],
    }),
    prisma.odg_staff_evaluation.findMany({
      where: { evaluator_code: emp.employee_code, target_code: emp.employee_code, year },
      select: { year: true, month: true },
    }),
    prisma.odg_staff_evaluation.findFirst({
      where: { evaluator_code: emp.employee_code, target_code: emp.employee_code, year, month },
    }),
    prisma.odg_staff_evaluation.findMany({
      where: { evaluator_code: emp.employee_code, target_code: { not: emp.employee_code }, year, month },
      orderBy: { created_at: 'desc' },
    }),
  ]);
  const targetCodes = [...new Set(evals.map(e => e.target_code))];
  const targetEmps = targetCodes.length > 0
    ? await prisma.odg_employee.findMany({ where: { employee_code: { in: targetCodes } }, select: { employee_code: true, fullname_lo: true } })
    : [];
  const nameMap = new Map(targetEmps.map(e => [e.employee_code, e.fullname_lo]));
  const evalsWithNames = evals.map(e => ({ ...e, target_name: nameMap.get(e.target_code) ?? null }));
  const selfEvalDoneMonths = new Set(
    selfAllResult.map((r) => r.month)
  );

  // Targets
  let targets: { employee_code: string; fullname_lo: string; source: string }[] = [];
  if (isManager) {
    // ລູກທີມ = ຄົນໃນພະແນກ/ໜ່ວຍງານ ທີ່ຕຳແໜ່ງຕ່ຳກ່ວາ
    const posCode = emp.position_code;
    const posNotIn = posCode === "11" ? ["11"] : ["11", "12"];
    const teamRows: { employee_code: string; fullname_lo: string }[] = await prisma.odg_employee.findMany({
      where: {
        OR: [{ department_code: emp.department_code }, { unit_code: emp.unit_code }],
        employee_code: { not: emp.employee_code },
        employment_status: "ACTIVE",
        position_code: { notIn: posNotIn },
      },
      select: { employee_code: true, fullname_lo: true },
      orderBy: { fullname_lo: 'asc' },
    });
    const assignedRows = await prisma.odg_staff_eval_assignment.findMany({
      where: { evaluator_code: emp.employee_code, year },
    });
    const assignedCodes = assignedRows.map(a => a.target_code);
    const assignedEmps = assignedCodes.length > 0
      ? await prisma.odg_employee.findMany({ where: { employee_code: { in: assignedCodes } }, select: { employee_code: true, fullname_lo: true } })
      : [];
    targets = teamRows.map((r) => ({
      ...r,
      source: "team",
    }));
    targets = [
      ...targets,
      ...assignedEmps.map((r) => ({
        ...r,
        source: "assigned",
      })),
    ];
  }

  // ເດືອນທີ່ປະເມີນໄດ້ ພາຍໃນປີ (ເດືອນກ່ອນໜ້າ)
  const currentYear = new Date().getFullYear();
  const currentMonth0 = new Date().getMonth(); // 0-indexed
  const availableMonths: { year: string; month: number; label: string; selfDone: boolean }[] = [];
  for (let m = 1; m <= currentMonth0; m++) {
    availableMonths.push({
      year: String(currentYear),
      month: m,
      label: `${MONTH_NAMES[m]} ${currentYear}`,
      selfDone: selfEvalDoneMonths.has(m),
    });
  }
  if (currentMonth0 === 0) {
    availableMonths.push({
      year: String(currentYear - 1),
      month: 12,
      label: `${MONTH_NAMES[12]} ${currentYear - 1}`,
      selfDone: selfEvalDoneMonths.has(12),
    });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <StaffEvalForm
          employeeCode={emp.employee_code}
          employeeName={emp.fullname_lo}
          isManager={isManager}
          criteria={criteria}
          selfEval={selfEval as React.ComponentProps<typeof StaffEvalForm>["selfEval"]}
          managerEvals={evalsWithNames as React.ComponentProps<typeof StaffEvalForm>["managerEvals"]}
          targets={targets}
          evalMonth={month}
          evalYear={year}
          evalMonthLabel={MONTH_NAMES[month]}
          availableMonths={availableMonths}
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
            ປະເມີນຜົນງານພະນັກງານ
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
