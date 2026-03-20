import { NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  const employeeCode = session?.employee?.employeeCode;
  if (!employeeCode) {
    return jsonError("No employee", 401);
  }

  const isManager = ["11", "12"].includes(session.employee!.positionCode);
  const year = String(new Date().getFullYear());

  try {
    const [criteriaRes, selfEvalsRes, teamEvalsRes] = await Promise.all([
      pool.query("SELECT * FROM odg_staff_eval_criteria ORDER BY question_order ASC"),
      pool.query(
        `SELECT * FROM odg_staff_evaluation
         WHERE evaluator_code = $1 AND target_code = $1 AND year = $2`,
        [employeeCode, year]
      ),
      isManager
        ? pool.query(
            `SELECT * FROM odg_staff_evaluation
             WHERE evaluator_code = $1 AND target_code != $1 AND year = $2`,
            [employeeCode, year]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    let teamTargetNames: { employee_code: string; fullname_lo: string }[] = [];
    if (isManager && teamEvalsRes.rows.length > 0) {
      const targetCodes = [
        ...new Set(teamEvalsRes.rows.map((row: Record<string, unknown>) => row.target_code as string)),
      ];
      const { rows } = await pool.query(
        "SELECT employee_code, fullname_lo FROM odg_employee WHERE employee_code = ANY($1)",
        [targetCodes]
      );
      teamTargetNames = rows;
    }

    return NextResponse.json({
      criteria: criteriaRes.rows,
      selfEvals: selfEvalsRes.rows,
      teamEvals: teamEvalsRes.rows,
      teamTargetNames,
      isManager,
    });
  } catch (err) {
    console.error("Failed to fetch staff eval summary:", err);
    return jsonError("Failed to fetch data", 500);
  }
}
