import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { getPublicUrl } from "@/lib/public-url";
import { ensureCrsSchema, getCrsViewer } from "@/lib/server/crs";
import { sendCrsRegistrationLineNotification } from "@/lib/server/line-messaging";
import { getSession } from "@/lib/server/session";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const topicId = Number(body.topicId);

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return jsonError("topicId ບໍ່ຖືກຕ້ອງ", 400);
    }

    const { rows: topicRows } = await pool.query(
      "SELECT id, title, location, scheduled_at, is_active FROM odg_crs_topic WHERE id = $1 LIMIT 1",
      [topicId]
    );

    if (topicRows.length === 0) {
      return jsonError("ບໍ່ພົບຫົວຂໍ້ CRS", 404);
    }
    if (!topicRows[0].is_active) {
      return jsonError("ຫົວຂໍ້ນີ້ປິດການລົງທະບຽນແລ້ວ", 409);
    }

    const { rows } = await pool.query(
      `INSERT INTO odg_crs_registration (
         topic_id,
         employee_code,
         employee_name,
         department_name,
         position_name
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (topic_id, employee_code) DO NOTHING
       RETURNING id`,
      [
        topicId,
        viewer.employeeCode,
        viewer.displayName,
        viewer.departmentName,
        viewer.positionName,
      ]
    );

    if (rows.length === 0) {
      return jsonError("ທ່ານລົງທະບຽນຫົວຂໍ້ນີ້ແລ້ວ", 409);
    }

    const lineNotification = await sendCrsRegistrationLineNotification({
      userId: session.lineUserId,
      title: topicRows[0].title,
      location: topicRows[0].location ?? null,
      scheduledAt: topicRows[0].scheduled_at ?? null,
      detailUrl: getPublicUrl(request, "/crs").toString(),
    });

    return NextResponse.json({ ok: true, lineNotification }, { status: 201 });
  } catch (error) {
    console.error("Failed to register CRS topic:", error);
    return jsonError("ບໍ່ສາມາດລົງທະບຽນ CRS ໄດ້", 500);
  }
}

export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const topicId = Number(body.topicId);

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return jsonError("topicId ບໍ່ຖືກຕ້ອງ", 400);
    }

    const { rows: topicRows } = await pool.query(
      "SELECT id, is_active FROM odg_crs_topic WHERE id = $1 LIMIT 1",
      [topicId]
    );

    if (topicRows.length === 0) {
      return jsonError("ບໍ່ພົບຫົວຂໍ້ CRS", 404);
    }
    if (!topicRows[0].is_active) {
      return jsonError("ຫົວຂໍ້ນີ້ປິດການລົງທະບຽນແລ້ວ ຈຶ່ງຍົກເລີກບໍ່ໄດ້", 409);
    }

    const { rows } = await pool.query(
      `DELETE FROM odg_crs_registration
       WHERE topic_id = $1
         AND employee_code = $2
       RETURNING id`,
      [topicId, viewer.employeeCode]
    );

    if (rows.length === 0) {
      return jsonError("ທ່ານຍັງບໍ່ໄດ້ລົງທະບຽນຫົວຂໍ້ນີ້", 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to cancel CRS registration:", error);
    return jsonError("ບໍ່ສາມາດຍົກເລີກການລົງທະບຽນ CRS ໄດ້", 500);
  }
}
