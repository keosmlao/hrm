import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AppLogo from "@/components/app-logo";
import SummaryTable from "./summary-table";

const MONTH_ABBR = [
  "", "ມ.ກ.", "ກ.ພ.", "ມີ.ນ.", "ເມ.ສ.", "ພ.ພ.", "ມິ.ຖ.",
  "ກ.ລ.", "ສ.ຫ.", "ກ.ຍ.", "ຕ.ລ.", "ພ.ຈ.", "ທ.ວ.",
];

interface SessionData {
  lineUserId: string;
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

interface SelfEvalRow {
  month: number;
  scores: Record<string, { option_id: number; score: number }>;
}

interface TeamEvalRow {
  target_code: string;
  target_name: string;
  position_name_lo: string | null;
  month: number;
  scores: Record<string, { option_id: number; score: number }>;
}

interface CriteriaInfo {
  criteria_code: string;
  criteria_name: string;
  question_order: number;
  group_name: string;
}

export default async function StaffEvalSummaryPage() {
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
          select: {
            employee_code: true,
            fullname_lo: true,
            position_code: true,
            unit_code: true,
            department_code: true,
          },
        }) || null;

  if (!emp) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
            <p className="text-brand-500">ບໍ່ພົບຂໍ້ມູນພະນັກງານ</p>
          </div>
        </main>
      </div>
    );
  }

  const year = String(new Date().getFullYear());
  const isManager = ["11", "12"].includes(emp.position_code ?? "");

  const [criteriaList, selfEvals] = await Promise.all([
    prisma.odg_staff_eval_criteria.findMany({
      distinct: ['criteria_code'],
      select: {
        criteria_code: true,
        criteria_name: true,
        question_order: true,
        group_name: true,
      },
      orderBy: { question_order: 'asc' },
    }),
    prisma.odg_staff_evaluation.findMany({
      where: {
        evaluator_code: emp.employee_code,
        target_code: emp.employee_code,
        year,
      },
      select: { month: true, scores: true },
      orderBy: { month: 'asc' },
    }),
  ]) as [CriteriaInfo[], SelfEvalRow[]];

  // Build self pivot: criteria × months
  const selfPivot = criteriaList.map((c) => {
    const monthScores: Record<number, number | null> = {};
    for (let m = 1; m <= 12; m++) {
      const evalForMonth = selfEvals.find((e) => e.month === m);
      if (evalForMonth && evalForMonth.scores[c.criteria_code]) {
        monthScores[m] = evalForMonth.scores[c.criteria_code].score;
      } else {
        monthScores[m] = null;
      }
    }
    return {
      criteria_code: c.criteria_code,
      criteria_name: c.criteria_name,
      group_name: c.group_name,
      question_order: c.question_order,
      scores: monthScores,
    };
  });

  // Team pivot (managers only)
  let teamPivot: {
    employee_code: string;
    fullname_lo: string;
    position_name_lo: string | null;
    scores: Record<number, number | null>;
  }[] = [];

  if (isManager) {
    const teamEvalRows = await prisma.odg_staff_evaluation.findMany({
      where: {
        evaluator_code: emp.employee_code,
        target_code: { not: emp.employee_code },
        year,
      },
      select: { target_code: true, month: true, scores: true },
      orderBy: { month: 'asc' },
    });

    const targetCodes = [...new Set(teamEvalRows.map(e => e.target_code))];
    const targetEmps = targetCodes.length > 0
      ? await prisma.odg_employee.findMany({
          where: { employee_code: { in: targetCodes } },
          include: { odg_position_rel: true },
        })
      : [];
    const empMap = new Map(targetEmps.map(e => [e.employee_code, e]));

    const teamEvalsWithInfo = teamEvalRows.map(r => ({
      ...r,
      fullname_lo: empMap.get(r.target_code)?.fullname_lo ?? '',
      position_name_lo: empMap.get(r.target_code)?.odg_position_rel?.position_name_lo ?? null,
    }));

    // Group by target
    const byTarget: Record<string, { fullname_lo: string; position_name_lo: string | null; evals: typeof teamEvalsWithInfo }> = {};
    for (const row of teamEvalsWithInfo) {
      if (!byTarget[row.target_code]) {
        byTarget[row.target_code] = {
          fullname_lo: row.fullname_lo,
          position_name_lo: row.position_name_lo,
          evals: [],
        };
      }
      byTarget[row.target_code].evals.push(row);
    }

    teamPivot = Object.entries(byTarget).map(([code, data]) => {
      const monthScores: Record<number, number | null> = {};
      for (let m = 1; m <= 12; m++) {
        const evalForMonth = data.evals.find((e) => e.month === m);
        if (evalForMonth && evalForMonth.scores) {
          const scores = evalForMonth.scores as Record<string, { option_id: number; score: number }>;
          const values = Object.values(scores).map((s) => s.score);
          monthScores[m] = values.length > 0
            ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
            : null;
        } else {
          monthScores[m] = null;
        }
      }
      return {
        employee_code: code,
        fullname_lo: data.fullname_lo,
        position_name_lo: data.position_name_lo,
        scores: monthScores,
      };
    });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <SummaryTable
          selfPivot={selfPivot}
          teamPivot={teamPivot}
          isManager={isManager}
          monthAbbr={MONTH_ABBR}
          year={year}
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
            ສະຫຼຸບການປະເມີນ
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
