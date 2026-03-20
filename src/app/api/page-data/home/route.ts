import { NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const whereClause = session.employee?.employeeCode
      ? { text: "e.employee_code = $1", value: session.employee.employeeCode }
      : { text: "e.line_id = $1", value: session.lineUserId };

    const { rows } = await pool.query(
      `SELECT e.*, p.position_name_lo, d.department_name_lo, u.unit_name_lo, dv.division_name_lo
       FROM odg_employee e
       LEFT JOIN odg_position p ON e.position_code = p.position_code
       LEFT JOIN odg_department d ON e.department_code = d.department_code
       LEFT JOIN odg_unit u ON e.unit_code = u.unit_code
       LEFT JOIN odg_division dv ON e.division_code = dv.division_code
       WHERE ${whereClause.text}
       LIMIT 1`,
      [whereClause.value]
    );

    const employeeRow = rows[0] || null;
    const emp = employeeRow
      ? {
          title_lo: employeeRow.title_lo,
          fullname_lo: employeeRow.fullname_lo,
          title_en: employeeRow.title_en,
          fullname_en: employeeRow.fullname_en,
          employee_code: employeeRow.employee_code,
          employment_status: employeeRow.employment_status,
          hire_date: employeeRow.hire_date,
          position_name_lo: employeeRow.position_name_lo ?? null,
          unit_name_lo: employeeRow.unit_name_lo ?? null,
          department_name_lo: employeeRow.department_name_lo ?? null,
          division_name_lo: employeeRow.division_name_lo ?? null,
        }
      : null;

    return NextResponse.json({ session, emp });
  } catch (err) {
    console.error("Failed to fetch home page data:", err);
    return jsonError("Failed to fetch data", 500);
  }
}
