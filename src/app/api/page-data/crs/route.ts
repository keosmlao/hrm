import { NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { ensureCrsSchema, getCrsViewer } from "@/lib/server/crs";
import { getSession } from "@/lib/server/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureCrsSchema();
    const viewer = await getCrsViewer(session);

    if (!viewer) {
      return jsonError("ບັນຊີນີ້ຍັງບໍ່ຖືກຈັບຄູ່ກັບ employee profile", 403);
    }

    const [topicsRes, participantRes, employeeTotalRes] = await Promise.all([
      pool.query(
        `SELECT t.id,
                t.title,
                t.image_url,
                t.description,
                t.location,
                t.scheduled_at,
                t.created_at,
                t.updated_at,
                t.created_by_name,
                t.is_active,
                COUNT(r.id)::int AS registered_count,
                COALESCE(BOOL_OR(r.employee_code = $1), FALSE) AS is_registered,
                MAX(r.registered_at) FILTER (WHERE r.employee_code = $1) AS my_registered_at
         FROM odg_crs_topic t
         LEFT JOIN odg_crs_registration r ON r.topic_id = t.id
         GROUP BY t.id
         ORDER BY t.is_active DESC,
                  COALESCE(t.scheduled_at, t.created_at) DESC,
                  t.id DESC`,
        [viewer.employeeCode]
      ),
      viewer.canManage
        ? pool.query(
            `SELECT topic_id,
                    employee_code,
                    employee_name,
                    department_name,
                    position_name,
                    registered_at
             FROM odg_crs_registration
             ORDER BY topic_id ASC, registered_at ASC`
          )
        : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
      pool.query("SELECT COUNT(*)::int AS total FROM odg_employee"),
    ]);

    const participantsByTopic = new Map<
      number,
      Array<{
        employeeCode: string;
        displayName: string;
        departmentName: string | null;
        positionName: string | null;
        registeredAt: string;
      }>
    >();

    for (const row of participantRes.rows) {
      const topicId = Number(row.topic_id);
      const items = participantsByTopic.get(topicId) || [];
      items.push({
        employeeCode: String(row.employee_code),
        displayName: String(row.employee_name),
        departmentName: row.department_name ? String(row.department_name) : null,
        positionName: row.position_name ? String(row.position_name) : null,
        registeredAt: new Date(String(row.registered_at)).toISOString(),
      });
      participantsByTopic.set(topicId, items);
    }

    const topics = topicsRes.rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      imageUrl: row.image_url ? String(row.image_url) : null,
      description: row.description ? String(row.description) : null,
      location: row.location ? String(row.location) : null,
      scheduledAt: row.scheduled_at ? new Date(String(row.scheduled_at)).toISOString() : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
      createdByName: row.created_by_name ? String(row.created_by_name) : null,
      isActive: Boolean(row.is_active),
      registeredCount: Number(row.registered_count ?? 0),
      isRegistered: Boolean(row.is_registered),
      myRegisteredAt: row.my_registered_at ? new Date(String(row.my_registered_at)).toISOString() : null,
      participants: participantsByTopic.get(Number(row.id)) || [],
    }));

    const uniqueRegistrantCount = viewer.canManage
      ? new Set(
          participantRes.rows.map((row) => String(row.employee_code))
        ).size
      : topics.filter((topic) => topic.isRegistered).length;

    return NextResponse.json({
      viewer,
      canManage: viewer.canManage,
      summary: {
        totalEmployees: Number(employeeTotalRes.rows[0]?.total ?? 0),
        totalTopics: topics.length,
        openTopics: topics.filter((topic) => topic.isActive).length,
        totalRegistrations: topics.reduce((sum, topic) => sum + topic.registeredCount, 0),
        uniqueRegistrants: uniqueRegistrantCount,
        myRegistrations: topics.filter((topic) => topic.isRegistered).length,
      },
      topics,
    });
  } catch (error) {
    console.error("Failed to fetch CRS page data:", error);
    return jsonError("Failed to fetch CRS data", 500);
  }
}
