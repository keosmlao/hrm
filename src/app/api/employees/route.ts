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
    const { rows } = await pool.query(
      "SELECT * FROM odg_employee ORDER BY employee_id ASC LIMIT 100"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Database query error:", err);
    return jsonError("Failed to fetch employees", 500);
  }
}
