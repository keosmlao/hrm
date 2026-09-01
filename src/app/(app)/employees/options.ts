import "server-only";
import { prisma } from "@/lib/prisma";
import { listPositions } from "@/lib/positions";
import type { Options } from "./employee-form";

export async function loadOptions(): Promise<Options> {
  const [divisions, departments, units, positions, employees] = await Promise.all([
    prisma.division.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.unit.findMany({ orderBy: { code: "asc" } }),
    listPositions(),
    prisma.employee.findMany({
      orderBy: { fullnameLo: "asc" },
      select: { code: true, fullnameLo: true },
      take: 500,
    }),
  ]);

  return {
    divisions: divisions.map((d) => ({ code: d.code, name: d.nameLo })),
    departments: departments.map((d) => ({
      code: d.code,
      name: `${d.code} — ${d.nameLo}`,
      divisionCode: d.divisionCode,
    })),
    units: units.map((u) => ({
      code: u.code,
      name: u.nameLo,
      departmentCode: u.departmentCode,
      isActive: u.isActive !== false,
    })),
    positions: positions.map((p) => ({ code: p.code, name: p.nameLo })),
    employees: employees.map((e) => ({ code: e.code, name: e.fullnameLo })),
  };
}
