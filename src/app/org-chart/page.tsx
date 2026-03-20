"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import OrgTree from "@/components/org-tree";
import type { OrgDivision, OrgDepartment, OrgUnit, OrgEmployee } from "@/components/org-tree";
import { AppShell, GlassPanel, HeaderIconTile, PageHero, PageLoading, PageMetric } from "@/components/app-shell";

export default function OrgChartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<OrgDivision[]>([]);

  useEffect(() => {
    apiFetch<{ divisions: unknown[]; departments: unknown[]; units: unknown[]; employees: unknown[] }>("/page-data/org-chart")
      .then((data) => {
        const allEmployees: OrgEmployee[] = (data.employees as Record<string, unknown>[]).map((e) => ({
          employee_code: e.employee_code as string,
          title_lo: e.title_lo as string | null,
          fullname_lo: e.fullname_lo as string,
          position_code: (e.position_code as string) ?? "",
          division_code: e.division_code as string,
          department_code: e.department_code as string | null,
          unit_code: e.unit_code as string | null,
          position_name_lo: (e.position_name_lo as string) ?? "",
        }));

        const unitRows = data.units as Record<string, string>[];
        const deptRows = data.departments as Record<string, string>[];
        const divRows = data.divisions as Record<string, string>[];

        const tree: OrgDivision[] = divRows.map((div) => {
          const departments: OrgDepartment[] = deptRows
            .filter((d) => d.division_code === div.division_code)
            .map((dept) => {
              const units: OrgUnit[] = unitRows
                .filter((u) => u.department_code === dept.department_code)
                .map((unit) => ({
                  unit_code: unit.unit_code,
                  unit_name_lo: unit.unit_name_lo,
                  employees: allEmployees.filter((e) => e.unit_code === unit.unit_code),
                }));
              const deptEmployees = allEmployees.filter(
                (e) => e.department_code === dept.department_code && (!e.unit_code || !unitRows.some((u) => u.unit_code === e.unit_code))
              );
              const employeeCount = deptEmployees.length + units.reduce((sum, u) => sum + u.employees.length, 0);
              return { department_code: dept.department_code, department_name_lo: dept.department_name_lo, units, employees: deptEmployees, employeeCount };
            });
          const employeeCount = departments.reduce((sum, d) => sum + d.employeeCount, 0);
          return { division_code: div.division_code, division_name_lo: div.division_name_lo, departments, employeeCount };
        });
        setDivisions(tree);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <PageLoading />;

  const totalDepartments = divisions.reduce((sum, division) => sum + division.departments.length, 0);
  const totalUnits = divisions.reduce(
    (sum, division) =>
      sum + division.departments.reduce((deptSum, department) => deptSum + department.units.length, 0),
    0
  );
  const totalEmployees = divisions.reduce((sum, division) => sum + division.employeeCount, 0);

  return (
    <AppShell
      title="ໂຄງສ້າງອົງກອນ"
      description="ເບິ່ງຜັງອົງກອນ ແລະ ຄວາມສຳພັນຂອງແຕ່ລະສາຍງານ"
      icon={<HeaderIconTile accent="amber"><HierarchyIcon className="h-5 w-5" /></HeaderIconTile>}
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <PageHero
          eyebrow="Organization Map"
          title="ໂຄງສ້າງທັງອົງກອນໃນມຸມມອງດຽວ"
          description="ສະແດງ division, department, unit ແລະ ພະນັກງານໃນຮູບແບບທີ່ອ່ານງ່າຍຂຶ້ນ ສຳລັບ desktop ແລະ mobile."
          badge="Live Structure"
          accent="amber"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <PageMetric label="Divisions" value={divisions.length} tone="amber" />
            <PageMetric label="Departments / Units" value={`${totalDepartments} / ${totalUnits}`} tone="blue" />
            <PageMetric label="Employees" value={totalEmployees} tone="teal" />
          </div>
        </PageHero>

        <GlassPanel className="px-4 py-5 sm:px-6">
          <OrgTree divisions={divisions} />
        </GlassPanel>
      </div>
    </AppShell>
  );
}

function HierarchyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1.5" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="12.5" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v3m0 0H4.5m5.5 0h5.5m-11 0v4m11-4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
