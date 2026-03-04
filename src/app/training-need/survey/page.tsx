import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AppLogo from "@/components/app-logo";
import TrainingNeedForm from "./training-need-form";

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeCode: string;
    fullnameLo: string;
    titleLo: string | null;
    departmentCode: string;
    positionCode: string;
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

export default async function SurveyPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  let emp: {
    employee_code: string;
    fullname_lo: string;
    title_lo: string | null;
    department_code: string | null;
    position_code: string | null;
    department_name_lo: string | null;
  } | null;

  if (session.employee) {
    const dept = await prisma.odg_department.findFirst({
      where: { department_code: session.employee.departmentCode },
      select: { department_name_lo: true },
    });
    emp = {
      employee_code: session.employee.employeeCode,
      fullname_lo: session.employee.fullnameLo,
      title_lo: session.employee.titleLo,
      department_code: session.employee.departmentCode,
      position_code: session.employee.positionCode,
      department_name_lo: dept?.department_name_lo || null,
    };
  } else {
    const empRow = await prisma.odg_employee.findFirst({
      where: { line_id: session.lineUserId },
      select: {
        employee_code: true,
        fullname_lo: true,
        title_lo: true,
        department_code: true,
        position_code: true,
        odg_department_rel: { select: { department_name_lo: true } },
      },
    });
    emp = empRow
      ? {
          employee_code: empRow.employee_code,
          fullname_lo: empRow.fullname_lo,
          title_lo: empRow.title_lo,
          department_code: empRow.department_code,
          position_code: empRow.position_code,
          department_name_lo: empRow.odg_department_rel?.department_name_lo || null,
        }
      : null;
  }

  // ສະເພາະຜູ້ຈັດການ (11) ແລະ ຫົວໜ້າ (12) ເທົ່ານັ້ນ
  if (!emp || !emp.position_code || !["11", "12"].includes(emp.position_code)) {
    redirect("/training-need");
  }

  const [existing, countResult, trainingNeeds] = await Promise.all([
    prisma.odg_training_survey.findFirst({
      where: { employee_code: emp.employee_code },
      select: { id: true },
    }),
    emp.department_code && emp.position_code
      ? prisma.odg_employee.count({
          where: {
            department_code: emp.department_code,
            position_code: { gt: emp.position_code },
          },
        })
      : Promise.resolve(0),
    prisma.odg_training_survey.findMany({
      where: { employee_code: emp.employee_code },
      orderBy: { created_at: 'desc' },
    }),
  ]);
  if (existing) {
    redirect("/training-need");
  }

  const teamCount = countResult;

  const displayName = emp
    ? `${emp.title_lo ? emp.title_lo + " " : ""}${emp.fullname_lo || ""}`
    : session.lineDisplayName || "";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <nav className="bg-brand-700 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <AppLogo className="shrink-0" />
            <h1 className="text-lg font-bold leading-tight text-white sm:text-xl">
              ແບບສຳຫຼວດຄວາມຕ້ອງການຝຶກອົບຮົມ
            </h1>
          </div>
          <Link
            href="/training-need"
            className="self-stretch rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-white/20 sm:self-auto"
          >
            ກັບຄືນ
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {emp ? (
          <TrainingNeedForm
            initialData={trainingNeeds as unknown as React.ComponentProps<typeof TrainingNeedForm>["initialData"]}
            employeeName={displayName}
            departmentName={emp.department_name_lo || "-"}
            teamCount={teamCount}
          />
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold text-brand-900">
              ບໍ່ພົບຂໍ້ມູນພະນັກງານ
            </h3>
            <p className="mt-2 text-brand-500">
              ບັນຊີ LINE ຂອງທ່ານຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນພະນັກງານໃນລະບົບ
            </p>
            <Link
              href="/home"
              className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              ກັບໜ້າຫຼັກ
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
