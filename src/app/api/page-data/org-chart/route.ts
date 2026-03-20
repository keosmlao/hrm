import { NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const divisionCode = session.employee?.divisionCode;
  if (!divisionCode) {
    return NextResponse.json({
      divisions: [],
      departments: [],
      units: [],
      employees: [],
    });
  }

  try {
    const [divisionsRes, departmentsRes, unitsRes, employeesRes] = await Promise.all([
      pool.query("SELECT * FROM odg_division WHERE division_code = $1", [divisionCode]),
      pool.query(
        "SELECT * FROM odg_department WHERE division_code = $1 ORDER BY department_code ASC",
        [divisionCode]
      ),
      pool.query("SELECT * FROM odg_unit ORDER BY unit_code ASC"),
      pool.query(
        `SELECT e.*, p.position_name_lo
         FROM odg_employee e
         LEFT JOIN odg_position p ON e.position_code = p.position_code
         WHERE e.employment_status = 'ACTIVE' AND e.division_code = $1
         ORDER BY e.position_code ASC, e.fullname_lo ASC`,
        [divisionCode]
      ),
    ]);

    return NextResponse.json({
      divisions: divisionsRes.rows,
      departments: departmentsRes.rows,
      units: unitsRes.rows,
      employees: employeesRes.rows,
    });
  } catch (err) {
    console.error("Failed to fetch org chart data:", err);
    return jsonError("Failed to fetch data", 500);
  }
}
