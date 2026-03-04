import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AppLogo from "@/components/app-logo";
import EvaluationForm from "./evaluation-form";

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeCode: string;
    fullnameLo: string;
    positionCode: string;
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

export default async function PerformanceEvaluationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const emp = session.employee
    ? {
        employee_code: session.employee.employeeCode,
        position_code: session.employee.positionCode,
        department_code: session.employee.departmentCode,
      }
    : await prisma.odg_employee.findFirst({
        where: { line_id: session.lineUserId },
        select: { employee_code: true, position_code: true, department_code: true },
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

  const canViewSummary =
    emp.position_code === "11" &&
    ["701", "801"].includes(emp.department_code ?? "");

  const [submitted, summaryRows] = await Promise.all([
    prisma.odg_od_evaluation.findUnique({
      where: { employee_code: emp.employee_code },
    }),
    canViewSummary
      ? prisma.$queryRaw<{ total: number; q1_good: number; q2_good: number; q3_good: number; q4_good: number; q5_good: number; q6_good: number }[]>`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE q1)::int as q1_good,
            COUNT(*) FILTER (WHERE q2)::int as q2_good,
            COUNT(*) FILTER (WHERE q3)::int as q3_good,
            COUNT(*) FILTER (WHERE q4)::int as q4_good,
            COUNT(*) FILTER (WHERE q5)::int as q5_good,
            COUNT(*) FILTER (WHERE q6)::int as q6_good
          FROM odg_od_evaluation`
      : Promise.resolve(null),
  ]);
  const stats = summaryRows?.[0] || null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <EvaluationForm
          submitted={submitted}
          summary={stats}
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
            ປະເມີນຜົນງານ OD 2026
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
