import { NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { ensureMeetingsSchema, getMeetingsViewer } from "@/lib/server/meetings";
import { getSession } from "@/lib/server/session";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);

    if (!viewer) {
      // Return minimal data — don't 403, let the page show "not linked" state
      return NextResponse.json({
        viewer: { employeeCode: null, displayName: session.lineDisplayName || "User", isIT: false, isOrganizer: false },
        organizers: [],
        employees: [],
      });
    }

    console.log("[Settings] viewer:", viewer.employeeCode, "dept:", viewer.departmentCode, "isIT:", viewer.isIT);

    // Organizers list (IT only)
    let organizers: Array<{ employeeCode: string; employeeName: string; assignedAt: string }> = [];
    if (viewer.isIT) {
      const orgRes = await pool.query(
        "SELECT employee_code, employee_name, assigned_at FROM odg_meeting_organizer ORDER BY assigned_at DESC"
      );
      organizers = orgRes.rows.map((r) => ({
        employeeCode: String(r.employee_code),
        employeeName: String(r.employee_name || r.employee_code),
        assignedAt: new Date(String(r.assigned_at)).toISOString(),
      }));
    }

    // Employee list for search (IT only)
    let employees: Array<{ employeeCode: string; displayName: string; departmentName: string | null }> = [];
    if (viewer.isIT) {
      const empRes = await pool.query(
        `SELECT e.employee_code, e.title_lo, e.fullname_lo, d.department_name_lo
         FROM odg_employee e
         LEFT JOIN odg_department d ON d.department_code = e.department_code
         ORDER BY e.fullname_lo ASC`
      );
      employees = empRes.rows.map((r) => ({
        employeeCode: String(r.employee_code),
        displayName: `${r.title_lo ? `${r.title_lo} ` : ""}${r.fullname_lo || r.employee_code}`.trim(),
        departmentName: r.department_name_lo ? String(r.department_name_lo) : null,
      }));
    }

    return NextResponse.json({
      viewer: {
        employeeCode: viewer.employeeCode,
        displayName: viewer.displayName,
        isIT: viewer.isIT,
        isOrganizer: viewer.isOrganizer,
      },
      organizers,
      employees,
    });
  } catch (error) {
    console.error("Failed to fetch settings page data:", error);
    return jsonError("Failed to fetch settings data", 500);
  }
}
