import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  const employee = session?.employee;
  if (!employee) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const canViewSummary =
      employee.positionCode === "11" && ["701", "801"].includes(employee.departmentCode);

    const [mineRows, summaryRows] = await Promise.all([
      pool.query("SELECT * FROM odg_od_evaluation WHERE employee_code = $1 LIMIT 1", [
        employee.employeeCode,
      ]),
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
      submitted: mineRows.rows[0] || null,
      summary: summaryRows?.rows[0] || null,
    });
  } catch (err) {
    console.error("Failed to fetch OD evaluation:", err);
    return jsonError("Failed to fetch evaluation", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const employee = session?.employee;
  if (!employee) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { q1, q2, q3, q4, q5, q6, comment } = body;

    if (
      typeof q1 !== "boolean" ||
      typeof q2 !== "boolean" ||
      typeof q3 !== "boolean" ||
      typeof q4 !== "boolean" ||
      typeof q5 !== "boolean" ||
      typeof q6 !== "boolean"
    ) {
      return jsonError("ກະລຸນາຕອບທຸກຄຳຖາມ", 400);
    }

    const { rows: existingRows } = await pool.query(
      "SELECT id FROM odg_od_evaluation WHERE employee_code = $1 LIMIT 1",
      [employee.employeeCode]
    );
    if (existingRows.length > 0) {
      return jsonError("ທ່ານໄດ້ປະເມີນແລ້ວ ບໍ່ສາມາດສົ່ງຊ້ຳໄດ້", 409);
    }

    const { rows } = await pool.query(
      `INSERT INTO odg_od_evaluation (employee_code, q1, q2, q3, q4, q5, q6, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [employee.employeeCode, q1, q2, q3, q4, q5, q6, comment || null]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("Failed to save OD evaluation:", err);
    return jsonError("ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້", 500);
  }
}
