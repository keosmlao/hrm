import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { ensureCrsSchema, getCrsViewer } from "@/lib/server/crs";
import { getSession } from "@/lib/server/session";

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOptionalImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value.trim();
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("/") ||
    normalized.startsWith("data:image/")
  ) {
    return normalized;
  }

  return "__invalid__";
}

function parseScheduledAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "__invalid__";
  return date.toISOString();
}

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
    if (!viewer.canManage) {
      return jsonError("ສິດນີ້ສະເພາະ IT ຫຼື HR", 403);
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const imageUrl = normalizeOptionalImageUrl(body.imageUrl);
    const description = normalizeOptionalText(body.description);
    const location = normalizeOptionalText(body.location);
    const scheduledAt = parseScheduledAt(body.scheduledAt);

    if (title.length < 3) {
      return jsonError("ກະລຸນາໃສ່ຫົວຂໍ້ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ", 400);
    }
    if (imageUrl === "__invalid__") {
      return jsonError("image URL ຕ້ອງເລີ່ມດ້ວຍ http://, https://, / ຫຼື data:image/", 400);
    }
    if (scheduledAt === "__invalid__") {
      return jsonError("ຮູບແບບວັນເວລາບໍ່ຖືກຕ້ອງ", 400);
    }

    const { rows } = await pool.query(
      `INSERT INTO odg_crs_topic (
         title,
         image_url,
         description,
         location,
         scheduled_at,
         created_by_employee_code,
         created_by_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        title,
        imageUrl,
        description,
        location,
        scheduledAt,
        viewer.employeeCode,
        viewer.displayName,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("Failed to create CRS topic:", error);
    return jsonError("ບໍ່ສາມາດສ້າງຫົວຂໍ້ CRS ໄດ້", 500);
  }
}

export async function PATCH(request: NextRequest) {
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
    if (!viewer.canManage) {
      return jsonError("ສິດນີ້ສະເພາະ IT ຫຼື HR", 403);
    }

    const body = await request.json();
    const topicId = Number(body.topicId);

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return jsonError("topicId ບໍ່ຖືກຕ້ອງ", 400);
    }

    let rows: Array<Record<string, unknown>> = [];

    if (
      typeof body.isActive === "boolean" &&
      body.title === undefined &&
      body.imageUrl === undefined &&
      body.description === undefined &&
      body.location === undefined &&
      body.scheduledAt === undefined
    ) {
      const { rows: toggleRows } = await pool.query(
        `UPDATE odg_crs_topic
         SET is_active = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [topicId, body.isActive]
      );
      rows = toggleRows;
    } else {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const imageUrl = normalizeOptionalImageUrl(body.imageUrl);
      const description = normalizeOptionalText(body.description);
      const location = normalizeOptionalText(body.location);
      const scheduledAt = parseScheduledAt(body.scheduledAt);

      if (title.length < 3) {
        return jsonError("ກະລຸນາໃສ່ຫົວຂໍ້ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ", 400);
      }
      if (imageUrl === "__invalid__") {
        return jsonError("image URL ຕ້ອງເລີ່ມດ້ວຍ http://, https://, / ຫຼື data:image/", 400);
      }
      if (scheduledAt === "__invalid__") {
        return jsonError("ຮູບແບບວັນເວລາບໍ່ຖືກຕ້ອງ", 400);
      }

      const { rows: updateRows } = await pool.query(
        `UPDATE odg_crs_topic
         SET title = $2,
             image_url = $3,
             description = $4,
             location = $5,
             scheduled_at = $6,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [topicId, title, imageUrl, description, location, scheduledAt]
      );
      rows = updateRows;
    }

    if (rows.length === 0) {
      return jsonError("ບໍ່ພົບຫົວຂໍ້ CRS", 404);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Failed to update CRS topic:", error);
    return jsonError("ບໍ່ສາມາດອັບເດດຫົວຂໍ້ CRS ໄດ້", 500);
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
    if (!viewer.canManage) {
      return jsonError("ສິດນີ້ສະເພາະ IT ຫຼື HR", 403);
    }

    const body = await request.json();
    const topicId = Number(body.topicId);

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return jsonError("topicId ບໍ່ຖືກຕ້ອງ", 400);
    }

    const { rows } = await pool.query(
      `DELETE FROM odg_crs_topic
       WHERE id = $1
       RETURNING id`,
      [topicId]
    );

    if (rows.length === 0) {
      return jsonError("ບໍ່ພົບຫົວຂໍ້ CRS", 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete CRS topic:", error);
    return jsonError("ບໍ່ສາມາດລົບຫົວຂໍ້ CRS ໄດ້", 500);
  }
}
