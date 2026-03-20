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
    const whereClause = session.employee
      ? { text: "employee_code = $1", value: session.employee.employeeCode }
      : { text: "line_id = $1", value: session.lineUserId };

    const { rows: employeeRows } = await pool.query(
      `SELECT employee_code, fullname_lo, position_code, department_code
       FROM odg_employee
       WHERE ${whereClause.text}
       LIMIT 1`,
      [whereClause.value]
    );
    const employee = employeeRows[0] || null;

    if (!employee) {
      return NextResponse.json({ emp: null });
    }

    const canViewSummary =
      employee.position_code === "11" &&
      ["701", "801"].includes(employee.department_code ?? "");

    const [submittedRes, summaryRes] = await Promise.all([
      pool.query(
        "SELECT * FROM odg_od_evaluation WHERE employee_code = $1 LIMIT 1",
        [employee.employee_code]
      ),
      canViewSummary
        ? pool.query(
            `SELECT COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE q1)::int as q1_good,
                    COUNT(*) FILTER (WHERE q2)::int as q2_good,
                    COUNT(*) FILTER (WHERE q3)::int as q3_good,
                    COUNT(*) FILTER (WHERE q4)::int as q4_good,
                    COUNT(*) FILTER (WHERE q5)::int as q5_good,
                    COUNT(*) FILTER (WHERE q6)::int as q6_good
             FROM odg_od_evaluation`
          )
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      emp: employee,
      canViewSummary,
      submitted: submittedRes.rows[0] || null,
      summary: summaryRes?.rows[0] || null,
    });
  } catch (err) {
    console.error("Failed to fetch performance evaluation page data:", err);
    return jsonError("Failed to fetch data", 500);
  }
}
