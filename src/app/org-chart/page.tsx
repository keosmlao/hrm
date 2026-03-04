import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AppLogo from "@/components/app-logo";
import OrgTree from "./org-tree";

interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    divisionCode: string;
  } | null;
}

export interface OrgEmployee {
  employee_code: string;
  title_lo: string | null;
  fullname_lo: string;
  position_code: string;
  position_name_lo: string;
  department_code: string | null;
  unit_code: string | null;
}

export interface OrgUnit {
  unit_code: string;
  unit_name_lo: string;
  employees: OrgEmployee[];
}

export interface OrgDepartment {
  department_code: string;
  department_name_lo: string;
  units: OrgUnit[];
  employees: OrgEmployee[]; // employees without unit
  employeeCount: number;
}

export interface OrgDivision {
  division_code: string;
  division_name_lo: string;
  departments: OrgDepartment[];
  employeeCount: number;
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

export default async function OrgChartPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // ດຶງ division_code ຂອງພະນັກງານທີ່ login
  const myDivisionCode =
    session.employee?.divisionCode ??
    (
      await prisma.odg_employee.findFirst({
        where: { line_id: session.lineUserId },
        select: { division_code: true },
      })
    )?.division_code ??
    undefined;

  // Fetch org data ສະເພາະຝ່າຍຂອງຕົນເອງ
  const [divRows, deptRows, unitRows, empRows] = await Promise.all([
    prisma.odg_division.findMany({
      where: { is_active: true, division_code: myDivisionCode },
    }),
    prisma.odg_department.findMany({
      where: { is_active: true, division_code: myDivisionCode },
      orderBy: { department_code: "asc" },
    }),
    prisma.odg_unit.findMany({
      where: {
        is_active: true,
        odg_department: { division_code: myDivisionCode },
      },
      orderBy: { unit_code: "asc" },
    }),
    prisma.odg_employee.findMany({
      where: { employment_status: "ACTIVE", division_code: myDivisionCode },
      include: { odg_position_rel: { select: { position_name_lo: true } } },
      orderBy: [{ position_code: "asc" }, { fullname_lo: "asc" }],
    }),
  ]);

  const allEmployees = empRows.map((e) => ({
    employee_code: e.employee_code,
    title_lo: e.title_lo,
    fullname_lo: e.fullname_lo,
    position_code: e.position_code ?? "",
    division_code: e.division_code,
    department_code: e.department_code,
    unit_code: e.unit_code,
    position_name_lo: e.odg_position_rel?.position_name_lo ?? "",
  }));

  // Build tree structure
  const divisions: OrgDivision[] = divRows.map((div) => {
    const departments: OrgDepartment[] = deptRows
      .filter((d) => d.division_code === div.division_code)
      .map((dept) => {
        const units: OrgUnit[] = unitRows
          .filter((u) => u.department_code === dept.department_code)
          .map((unit) => ({
            unit_code: unit.unit_code,
            unit_name_lo: unit.unit_name_lo,
            employees: allEmployees.filter(
              (e) => e.unit_code === unit.unit_code
            ),
          }));

        // Employees directly under department (no unit)
        const deptEmployees = allEmployees.filter(
          (e) =>
            e.department_code === dept.department_code &&
            (!e.unit_code ||
              !unitRows.some((u) => u.unit_code === e.unit_code))
        );

        const employeeCount =
          deptEmployees.length +
          units.reduce((sum, u) => sum + u.employees.length, 0);

        return {
          department_code: dept.department_code,
          department_name_lo: dept.department_name_lo,
          units,
          employees: deptEmployees,
          employeeCount,
        };
      });

    const employeeCount = departments.reduce(
      (sum, d) => sum + d.employeeCount,
      0
    );

    return {
      division_code: div.division_code,
      division_name_lo: div.division_name_lo,
      departments,
      employeeCount,
    };
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <nav className="bg-brand-700 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <AppLogo className="shrink-0" />
            <h1 className="text-lg font-bold leading-tight text-white sm:text-xl">
              ໂຄງສ້າງອົງກອນ
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <OrgTree divisions={divisions} />
      </main>
    </div>
  );
}
