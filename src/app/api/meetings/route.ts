import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { ensureMeetingsSchema, getMeetingsViewer } from "@/lib/server/meetings";
import { getSession } from "@/lib/server/session";

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "__invalid__";
  return value.trim();
}

function parseTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return "__invalid__";
  return trimmed;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);
    if (!viewer.isOrganizer) return jsonError("ທ່ານບໍ່ມີສິດສ້າງການປະຊຸມ. ກະລຸນາຕິດຕໍ່ IT ເພື່ອຂໍສິດ.", 403);

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = normalizeOptionalText(body.description);
    const location = normalizeOptionalText(body.location);
    const meetingDate = parseDate(body.meetingDate);
    const startTime = parseTime(body.startTime);
    const endTime = parseTime(body.endTime);

    if (title.length < 2) return jsonError("ກະລຸນາໃສ່ຫົວຂໍ້ຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ", 400);
    if (!meetingDate) return jsonError("ກະລຸນາເລືອກວັນທີ", 400);
    if (meetingDate === "__invalid__") return jsonError("ວັນທີບໍ່ຖືກຕ້ອງ", 400);
    if (startTime === "__invalid__") return jsonError("ເວລາເລີ່ມບໍ່ຖືກຕ້ອງ", 400);
    if (endTime === "__invalid__") return jsonError("ເວລາສິ້ນສຸດບໍ່ຖືກຕ້ອງ", 400);

    const { rows } = await pool.query(
      `INSERT INTO odg_meeting (title, description, location, meeting_date, start_time, end_time, created_by_code, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, location, meetingDate, startTime, endTime, viewer.employeeCode, viewer.displayName]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("Failed to create meeting:", error);
    return jsonError("ບໍ່ສາມາດສ້າງການປະຊຸມໄດ້", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);

    const body = await request.json();
    const meetingId = Number(body.meetingId);
    if (!Number.isInteger(meetingId) || meetingId <= 0) return jsonError("meetingId ບໍ່ຖືກຕ້ອງ", 400);

    const { rows: existing } = await pool.query(
      "SELECT created_by_code FROM odg_meeting WHERE id = $1 LIMIT 1",
      [meetingId]
    );
    if (existing.length === 0) return jsonError("ບໍ່ພົບການປະຊຸມ", 404);
    if (existing[0].created_by_code !== viewer.employeeCode) return jsonError("ສາມາດແກ້ໄຂໄດ້ສະເພາະຜູ້ສ້າງ", 403);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = normalizeOptionalText(body.description);
    const location = normalizeOptionalText(body.location);
    const meetingDate = parseDate(body.meetingDate);
    const startTime = parseTime(body.startTime);
    const endTime = parseTime(body.endTime);

    if (title.length < 2) return jsonError("ກະລຸນາໃສ່ຫົວຂໍ້ຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ", 400);
    if (!meetingDate) return jsonError("ກະລຸນາເລືອກວັນທີ", 400);
    if (meetingDate === "__invalid__") return jsonError("ວັນທີບໍ່ຖືກຕ້ອງ", 400);
    if (startTime === "__invalid__") return jsonError("ເວລາເລີ່ມບໍ່ຖືກຕ້ອງ", 400);
    if (endTime === "__invalid__") return jsonError("ເວລາສິ້ນສຸດບໍ່ຖືກຕ້ອງ", 400);

    const { rows } = await pool.query(
      `UPDATE odg_meeting
       SET title = $2, description = $3, location = $4, meeting_date = $5, start_time = $6, end_time = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [meetingId, title, description, location, meetingDate, startTime, endTime]
    );

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Failed to update meeting:", error);
    return jsonError("ບໍ່ສາມາດແກ້ໄຂການປະຊຸມໄດ້", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);

    const body = await request.json();
    const meetingId = Number(body.meetingId);
    if (!Number.isInteger(meetingId) || meetingId <= 0) return jsonError("meetingId ບໍ່ຖືກຕ້ອງ", 400);

    const { rows: existing } = await pool.query(
      "SELECT created_by_code FROM odg_meeting WHERE id = $1 LIMIT 1",
      [meetingId]
    );
    if (existing.length === 0) return jsonError("ບໍ່ພົບການປະຊຸມ", 404);
    if (existing[0].created_by_code !== viewer.employeeCode) return jsonError("ສາມາດລົບໄດ້ສະເພາະຄົນຈັດປະຊຸມ", 403);

    await pool.query("DELETE FROM odg_meeting WHERE id = $1", [meetingId]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete meeting:", error);
    return jsonError("ບໍ່ສາມາດລົບການປະຊຸມໄດ້", 500);
  }
}
