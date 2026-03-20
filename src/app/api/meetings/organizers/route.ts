import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { ensureMeetingsSchema, getMeetingsViewer, lookupEmployee } from "@/lib/server/meetings";
import { getSession } from "@/lib/server/session";

/** IT assigns organizers */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);
    if (!viewer.isIT) return jsonError("ສິດນີ້ສະເພາະ IT", 403);

    const body = await request.json();
    const employeeCode = typeof body.employeeCode === "string" ? body.employeeCode.trim() : "";
    if (!employeeCode) return jsonError("ກະລຸນາລະບຸລະຫັດພະນັກງານ", 400);

    const emp = await lookupEmployee(employeeCode);
    if (!emp) return jsonError("ບໍ່ພົບພະນັກງານ", 404);

    const { rows } = await pool.query(
      `INSERT INTO odg_meeting_organizer (employee_code, employee_name, assigned_by_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_code) DO NOTHING
       RETURNING id`,
      [emp.employeeCode, emp.displayName, viewer.employeeCode]
    );

    if (rows.length === 0) return jsonError("ພະນັກງານນີ້ເປັນຜູ້ຈັດປະຊຸມແລ້ວ", 409);

    return NextResponse.json({ ok: true, employeeCode: emp.employeeCode, displayName: emp.displayName }, { status: 201 });
  } catch (error) {
    console.error("Failed to add organizer:", error);
    return jsonError("ບໍ່ສາມາດເພີ່ມຜູ້ຈັດປະຊຸມໄດ້", 500);
  }
}

/** IT removes organizer */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);
    if (!viewer.isIT) return jsonError("ສິດນີ້ສະເພາະ IT", 403);

    const body = await request.json();
    const employeeCode = typeof body.employeeCode === "string" ? body.employeeCode.trim() : "";
    if (!employeeCode) return jsonError("ກະລຸນາລະບຸລະຫັດພະນັກງານ", 400);

    const { rows } = await pool.query(
      "DELETE FROM odg_meeting_organizer WHERE employee_code = $1 RETURNING id",
      [employeeCode]
    );

    if (rows.length === 0) return jsonError("ບໍ່ພົບຜູ້ຈັດປະຊຸມນີ້", 404);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove organizer:", error);
    return jsonError("ບໍ່ສາມາດລົບຜູ້ຈັດປະຊຸມໄດ້", 500);
  }
}
