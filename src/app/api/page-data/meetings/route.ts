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
    console.log("[page-data/meetings] schema ok, looking up viewer...");
    const viewer = await getMeetingsViewer(session);
    console.log("[page-data/meetings] viewer:", viewer?.employeeCode ?? "null", "isOrganizer:", viewer?.isOrganizer ?? "n/a");
    if (!viewer) {
      // Return empty data instead of 403 so home page calendar still works
      return NextResponse.json({
        viewer: { employeeCode: null, displayName: session.lineDisplayName || "User", isIT: false, isOrganizer: false },
        meetings: [],
        organizers: [],
        employees: [],
        summary: { totalMeetings: 0, myMeetings: 0, joinedMeetings: 0 },
      });
    }

    // Fetch meetings: organizer sees all, normal user sees only meetings they're invited to
    const meetingsRes = viewer.isOrganizer
      ? await pool.query(
          `SELECT m.id, m.title, m.description, m.location, m.meeting_date, m.start_time, m.end_time,
                  m.created_by_code, m.created_by_name, m.created_at,
                  COUNT(p.id)::int AS participant_count,
                  COALESCE(BOOL_OR(p.employee_code = $1), FALSE) AS is_joined
           FROM odg_meeting m
           LEFT JOIN odg_meeting_participant p ON p.meeting_id = m.id
           GROUP BY m.id
           ORDER BY m.meeting_date DESC, m.start_time ASC NULLS LAST, m.id DESC`,
          [viewer.employeeCode]
        )
      : await pool.query(
          `SELECT m.id, m.title, m.description, m.location, m.meeting_date, m.start_time, m.end_time,
                  m.created_by_code, m.created_by_name, m.created_at,
                  COUNT(p2.id)::int AS participant_count,
                  TRUE AS is_joined
           FROM odg_meeting_participant p
           JOIN odg_meeting m ON m.id = p.meeting_id
           LEFT JOIN odg_meeting_participant p2 ON p2.meeting_id = m.id
           WHERE p.employee_code = $1
           GROUP BY m.id
           ORDER BY m.meeting_date DESC, m.start_time ASC NULLS LAST, m.id DESC`,
          [viewer.employeeCode]
        );

    // Fetch participants for all visible meetings
    const meetingIds = meetingsRes.rows.map((r) => Number(r.id));
    const participantsByMeeting = new Map<number, Array<{
      employeeCode: string;
      displayName: string;
      departmentName: string | null;
      positionName: string | null;
      notified: boolean;
      responseStatus: "pending" | "accepted" | "rejected";
      responseReason: string | null;
      respondedAt: string | null;
      joinedAt: string;
    }>>();

    if (meetingIds.length > 0) {
      const participantsRes = await pool.query(
        `SELECT meeting_id, employee_code, employee_name, department_name, position_name, notified,
                response_status, response_reason, responded_at, joined_at
         FROM odg_meeting_participant
         WHERE meeting_id = ANY($1)
         ORDER BY meeting_id ASC, joined_at ASC`,
        [meetingIds]
      );

      for (const row of participantsRes.rows) {
        const mid = Number(row.meeting_id);
        const items = participantsByMeeting.get(mid) || [];
        items.push({
          employeeCode: String(row.employee_code),
          displayName: String(row.employee_name),
          departmentName: row.department_name ? String(row.department_name) : null,
          positionName: row.position_name ? String(row.position_name) : null,
          notified: Boolean(row.notified),
          responseStatus: row.response_status === "accepted" || row.response_status === "rejected" ? row.response_status : "pending",
          responseReason: row.response_reason ? String(row.response_reason) : null,
          respondedAt: row.responded_at ? new Date(String(row.responded_at)).toISOString() : null,
          joinedAt: new Date(String(row.joined_at)).toISOString(),
        });
        participantsByMeeting.set(mid, items);
      }
    }

    const meetings = meetingsRes.rows.map((row) => {
      const participants = participantsByMeeting.get(Number(row.id)) || [];
      const viewerParticipant = participants.find((participant) => participant.employeeCode === viewer.employeeCode) || null;

      return {
        id: Number(row.id),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        location: row.location ? String(row.location) : null,
        meetingDate: row.meeting_date ? new Date(String(row.meeting_date)).toISOString().slice(0, 10) : null,
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
        endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
        createdByCode: String(row.created_by_code),
        createdByName: row.created_by_name ? String(row.created_by_name) : null,
        createdAt: new Date(String(row.created_at)).toISOString(),
        participantCount: Number(row.participant_count ?? 0),
        isJoined: viewerParticipant?.responseStatus === "accepted",
        isOwner: String(row.created_by_code) === viewer.employeeCode,
        isViewerParticipant: Boolean(viewerParticipant),
        myResponseStatus: viewerParticipant?.responseStatus ?? null,
        myResponseReason: viewerParticipant?.responseReason ?? null,
        myRespondedAt: viewerParticipant?.respondedAt ?? null,
        participants,
      };
    });

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

    // Employee list for search (organizer only)
    let employees: Array<{ employeeCode: string; displayName: string; departmentName: string | null }> = [];
    if (viewer.isOrganizer) {
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
      meetings,
      organizers,
      employees,
      summary: {
        totalMeetings: meetings.length,
        myMeetings: meetings.filter((m) => m.isOwner).length,
        joinedMeetings: meetings.filter((m) => m.myResponseStatus === "accepted").length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch meetings page data:", error);
    return jsonError("Failed to fetch meetings data", 500);
  }
}
