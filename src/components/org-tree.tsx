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
  employees: OrgEmployee[];
  employeeCount: number;
}

export interface OrgDivision {
  division_code: string;
  division_name_lo: string;
  departments: OrgDepartment[];
  employeeCount: number;
}

export default function OrgTree({
  divisions,
}: {
  divisions: OrgDivision[];
}) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max flex-col items-center space-y-12 px-2">
        {divisions.map((div) => (
          <DivisionChart key={div.division_code} division={div} />
        ))}
      </div>
    </div>
  );
}

function DivisionChart({ division }: { division: OrgDivision }) {
  return (
    <div className="flex flex-col items-center">
      {/* Division Box */}
      <ChartBox
        title={division.division_name_lo}
        subtitle={`${division.employeeCount} ຄົນ`}
        level="division"
      />

      {/* Departments */}
      {division.departments.length > 0 && (
        <>
          <VerticalLine />
          <div className="relative flex justify-center gap-3 sm:gap-6">
            {/* Horizontal connector line */}
            {division.departments.length > 1 && (
              <div className="absolute left-1/2 top-0 h-px -translate-x-1/2 bg-slate-300/80" style={{ width: `calc(100% - 80px)` }} />
            )}
            {division.departments.map((dept) => (
              <DepartmentChart key={dept.department_code} department={dept} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DepartmentChart({ department }: { department: OrgDepartment }) {
  return (
    <div className="flex flex-col items-center">
      {/* Department Box */}
      <ChartBox
        title={department.department_name_lo}
        subtitle={`${department.employeeCount} ຄົນ`}
        level="department"
      />

      {/* ພະນັກງານ (ສະແດງຕາມ position: ຜູ້ຈັດການ → ຫົວໜ້າ → ພະນັກງານ) */}
      {department.employees.length > 0 && (
        <>
          <VerticalLine />
          <div className="flex flex-col items-center gap-1">
            {department.employees.map((emp) => (
              <ChartBox
                key={emp.employee_code}
                title={`${emp.title_lo ? emp.title_lo + " " : ""}${emp.fullname_lo}`}
                subtitle={emp.position_name_lo}
                level={getEmployeeLevel(emp.position_code)}
              />
            ))}
          </div>
        </>
      )}

      {/* Units */}
      {department.units.length > 0 && (
        <>
          <VerticalLine />
          <div className="relative flex justify-center gap-3 sm:gap-6">
            {department.units.length > 1 && (
              <div className="absolute left-1/2 top-0 h-px -translate-x-1/2 bg-slate-300/80" style={{ width: `calc(100% - 80px)` }} />
            )}
            {department.units.map((unit) => (
              <UnitChart key={unit.unit_code} unit={unit} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getEmployeeLevel(positionCode: string) {
  if (positionCode === "11") return "manager";
  if (positionCode === "12") return "head";
  return "employee";
}

function UnitChart({ unit }: { unit: OrgUnit }) {
  return (
    <div className="flex flex-col items-center">
      <ChartBox
        title={unit.unit_name_lo}
        subtitle={`${unit.employees.length} ຄົນ`}
        level="unit"
      />
      {unit.employees.length > 0 && (
        <>
          <VerticalLine />
          <div className="flex flex-col items-center gap-1">
            {unit.employees.map((emp) => (
              <ChartBox
                key={emp.employee_code}
                title={`${emp.title_lo ? emp.title_lo + " " : ""}${emp.fullname_lo}`}
                subtitle={emp.position_name_lo}
                level={getEmployeeLevel(emp.position_code)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const levelStyles: Record<string, string> = {
  division: "border-violet-300/70 bg-gradient-to-br from-violet-600 via-blue-600 to-teal-500 text-white shadow-[0_14px_32px_-18px_rgba(59,130,246,0.85)]",
  manager: "border-blue-200 bg-white/85 text-slate-900 shadow-[0_10px_24px_-18px_rgba(59,130,246,0.45)] backdrop-blur",
  department: "border-blue-300/70 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_14px_32px_-18px_rgba(79,70,229,0.65)]",
  head: "border-amber-200 bg-amber-50/90 text-amber-900 shadow-[0_10px_24px_-18px_rgba(245,158,11,0.6)] backdrop-blur",
  unit: "border-teal-300/70 bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_14px_32px_-18px_rgba(16,185,129,0.7)]",
  employee: "border-white/70 bg-white/85 text-slate-800 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)] backdrop-blur",
};

const levelWidths: Record<string, number> = {
  division: 170,
  department: 170,
  unit: 160,
  manager: 180,
  head: 180,
  employee: 180,
};

function ChartBox({
  title,
  subtitle,
  level,
}: {
  title: string;
  subtitle: string;
  level: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-center sm:px-5 sm:py-3.5 ${levelStyles[level] || levelStyles.employee}`}
      style={{ minWidth: levelWidths[level] || levelWidths.employee }}
    >
      <div className="text-xs font-semibold leading-tight sm:text-sm">
        {title}
      </div>
      <div className="mt-1 text-[0.65rem] opacity-80 sm:text-xs">
        {subtitle}
      </div>
    </div>
  );
}

function VerticalLine() {
  return <div className="h-7 w-px bg-slate-300/80" />;
}
