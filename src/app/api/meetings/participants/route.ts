import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { getPublicUrl } from "@/lib/public-url";
import { ensureMeetingsSchema, getMeetingsViewer, lookupEmployee } from "@/lib/server/meetings";
import { sendMeetingNotification } from "@/lib/server/line-messaging";
import { getSession } from "@/lib/server/session";

function normalizeOptionalText(value: unknown, maxLength = 600) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Add multiple participants and notify via LINE */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);

    const body = await request.json();
    const meetingId = Number(body.meetingId);
    if (!Number.isInteger(meetingId) || meetingId <= 0) return jsonError("meetingId ບໍ່ຖືກຕ້ອງ", 400);

    // Check meeting exists and viewer is creator
    const { rows: meetingRows } = await pool.query(
      "SELECT id, title, meeting_date, start_time, end_time, location, created_by_code, created_by_name FROM odg_meeting WHERE id = $1 LIMIT 1",
      [meetingId]
    );
    if (meetingRows.length === 0) return jsonError("ບໍ່ພົບການປະຊຸມ", 404);
    const meeting = meetingRows[0];

    if (meeting.created_by_code !== viewer.employeeCode) {
      return jsonError("ສາມາດແກ້ໄຂລາຍຊື່ຜູ້ເຂົ້າຮ່ວມໄດ້ສະເພາະຄົນຈັດປະຊຸມ", 403);
    }

    // Accept single or multiple employee codes
    const employeeCodes: string[] = Array.isArray(body.employeeCodes)
      ? body.employeeCodes.filter((c: unknown) => typeof c === "string" && c.trim())
      : typeof body.employeeCode === "string" && body.employeeCode.trim()
        ? [body.employeeCode.trim()]
        : [];

    if (employeeCodes.length === 0) return jsonError("ກະລຸນາລະບຸລະຫັດພະນັກງານ", 400);

    const added: string[] = [];
    const skipped: string[] = [];
    const notFound: string[] = [];
    const notified: string[] = [];
    const detailUrl = getPublicUrl(request, "/meetings").toString();

    for (const code of employeeCodes) {
      const emp = await lookupEmployee(code.trim());
      if (!emp) { notFound.push(code); continue; }

      const { rows } = await pool.query(
        `INSERT INTO odg_meeting_participant (meeting_id, employee_code, employee_name, department_name, position_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (meeting_id, employee_code) DO NOTHING
         RETURNING id`,
        [meetingId, emp.employeeCode, emp.displayName, emp.departmentName, emp.positionName]
      );

      if (rows.length === 0) { skipped.push(code); continue; }
      added.push(code);

      // Send LINE notification
      if (emp.lineId) {
        const result = await sendMeetingNotification({
          userId: emp.lineId,
          title: meeting.title,
          meetingDate: meeting.meeting_date ? new Date(meeting.meeting_date).toISOString().slice(0, 10) : null,
          startTime: meeting.start_time ? String(meeting.start_time).slice(0, 5) : null,
          endTime: meeting.end_time ? String(meeting.end_time).slice(0, 5) : null,
          location: meeting.location ?? null,
          organizerName: meeting.created_by_name ?? null,
          detailUrl,
        });

        if (result.sent) {
          notified.push(code);
          await pool.query(
            "UPDATE odg_meeting_participant SET notified = TRUE WHERE meeting_id = $1 AND employee_code = $2",
            [meetingId, emp.employeeCode]
          );
        }
      }
    }

    return NextResponse.json({ ok: true, added: added.length, skipped: skipped.length, notFound, notified: notified.length }, { status: 201 });
  } catch (error) {
    console.error("Failed to add meeting participants:", error);
    return jsonError("ບໍ່ສາມາດເພີ່ມຜູ້ເຂົ້າຮ່ວມໄດ້", 500);
  }
}

/** Remove a participant */
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

    // Only the meeting creator can remove participants
    const employeeCode = typeof body.employeeCode === "string" && body.employeeCode.trim()
      ? body.employeeCode.trim()
      : viewer.employeeCode;

    const { rows: meetingRows } = await pool.query(
      "SELECT created_by_code FROM odg_meeting WHERE id = $1 LIMIT 1",
      [meetingId]
    );
    if (meetingRows.length === 0) return jsonError("ບໍ່ພົບການປະຊຸມ", 404);
    if (meetingRows[0].created_by_code !== viewer.employeeCode) {
      return jsonError("ສາມາດລົບຜູ້ເຂົ້າຮ່ວມໄດ້ສະເພາະຄົນຈັດປະຊຸມ", 403);
    }

    const { rows } = await pool.query(
      `DELETE FROM odg_meeting_participant WHERE meeting_id = $1 AND employee_code = $2 RETURNING id`,
      [meetingId, employeeCode]
    );

    if (rows.length === 0) return jsonError("ບໍ່ພົບຜູ້ເຂົ້າຮ່ວມນີ້", 404);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove meeting participant:", error);
    return jsonError("ບໍ່ສາມາດລົບຜູ້ເຂົ້າຮ່ວມໄດ້", 500);
  }
}

/** Participant responds to invitation */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    await ensureMeetingsSchema();
    const viewer = await getMeetingsViewer(session);
    if (!viewer) return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);

    const body = await request.json();
    const meetingId = Number(body.meetingId);
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const reason = normalizeOptionalText(body.reason);

    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      return jsonError("meetingId ບໍ່ຖືກຕ້ອງ", 400);
    }
    if (status !== "accepted" && status !== "rejected") {
      return jsonError("status ຕ້ອງເປັນ accepted ຫຼື rejected", 400);
    }
    if (status === "rejected" && !reason) {
      return jsonError("ກະລຸນາລະບຸເຫດຜົນການປະຕິເສດ", 400);
    }

    const { rows: existing } = await pool.query(
      `SELECT id
       FROM odg_meeting_participant
       WHERE meeting_id = $1
         AND employee_code = $2
       LIMIT 1`,
      [meetingId, viewer.employeeCode]
    );

    if (existing.length === 0) {
      return jsonError("ທ່ານບໍ່ໄດ້ຖືກເຊີນເຂົ້າປະຊຸມນີ້", 404);
    }

    await pool.query(
      `UPDATE odg_meeting_participant
       SET response_status = $3,
           response_reason = $4,
           responded_at = NOW()
       WHERE meeting_id = $1
         AND employee_code = $2`,
      [meetingId, viewer.employeeCode, status, status === "rejected" ? reason : null]
    );

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Failed to update meeting response:", error);
    return jsonError("ບໍ່ສາມາດບັນທຶກການຕອບຮັບໄດ້", 500);
  }
}
