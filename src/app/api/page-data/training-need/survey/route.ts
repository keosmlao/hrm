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
    let employee: {
      employee_code: string;
      fullname_lo: string;
      title_lo: string | null;
      department_code: string | null;
      position_code: string | null;
      department_name_lo: string | null;
    } | null = null;

    if (session.employee) {
      const { rows } = await pool.query(
        "SELECT department_name_lo FROM odg_department WHERE department_code = $1 LIMIT 1",
        [session.employee.departmentCode]
      );
      employee = {
        employee_code: session.employee.employeeCode,
        fullname_lo: session.employee.fullnameLo ?? "",
        title_lo: session.employee.titleLo ?? null,
        department_code: session.employee.departmentCode,
        position_code: session.employee.positionCode,
        department_name_lo: rows[0]?.department_name_lo || null,
      };
    } else {
      const { rows } = await pool.query(
        `SELECT e.employee_code, e.fullname_lo, e.title_lo, e.department_code, e.position_code, d.department_name_lo
         FROM odg_employee e
         LEFT JOIN odg_department d ON e.department_code = d.department_code
         WHERE e.line_id = $1
         LIMIT 1`,
        [session.lineUserId]
      );
      employee = rows[0] || null;
    }

    if (!employee || !employee.position_code || !["11", "12"].includes(employee.position_code)) {
      return jsonError("Access denied", 403);
    }

    const [existingRes, countRes, trainingNeedsRes] = await Promise.all([
      pool.query(
        "SELECT id FROM odg_training_survey WHERE employee_code = $1 LIMIT 1",
        [employee.employee_code]
      ),
      employee.department_code && employee.position_code
        ? pool.query(
            `SELECT COUNT(*)::int as total
             FROM odg_employee
             WHERE department_code = $1 AND position_code > $2`,
            [employee.department_code, employee.position_code]
          )
        : Promise.resolve({ rows: [{ total: 0 }] }),
      pool.query(
        "SELECT * FROM odg_training_survey WHERE employee_code = $1 ORDER BY created_at DESC",
        [employee.employee_code]
      ),
    ]);

    if (existingRes.rows.length > 0) {
      return NextResponse.json({ alreadySubmitted: true });
    }

    const displayName = `${employee.title_lo ? `${employee.title_lo} ` : ""}${employee.fullname_lo || ""}`;
    return NextResponse.json({
      alreadySubmitted: false,
      employeeName: displayName,
      departmentName: employee.department_name_lo || "-",
      teamCount: countRes.rows[0].total,
      trainingNeeds: trainingNeedsRes.rows,
    });
  } catch (err) {
    console.error("Failed to fetch training survey page data:", err);
    return jsonError("Failed to fetch data", 500);
  }
}
