import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

const SKILL_IDS = Array.from({ length: 16 }, (_, index) => String(index + 1));
const MAX_SKILL_PRIORITY = SKILL_IDS.length;
const ALLOWED_SUPERVISOR_YEARS = ["<1", "1-3", ">3"];

function validateSkillPriorities(skillPriorities: unknown) {
  if (!skillPriorities || typeof skillPriorities !== "object" || Array.isArray(skillPriorities)) {
    return "ຂໍ້ມູນລຳດັບທັກສະບໍ່ຖືກຕ້ອງ";
  }

  const record = skillPriorities as Record<string, unknown>;
  const allowedKeys = new Set([...SKILL_IDS, "16_topic"]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) return "ພົບຂໍ້ມູນທັກສະທີ່ບໍ່ຖືກຕ້ອງ";
  }

  const seen = new Set<number>();
  for (const skillId of SKILL_IDS) {
    const value = record[skillId];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_SKILL_PRIORITY) {
      return `ກະລຸນາໃສ່ລຳດັບ 1-${MAX_SKILL_PRIORITY} ໃຫ້ຄົບທຸກຂໍ້`;
    }
    if (seen.has(value)) return "ລຳດັບຄວາມສຳຄັນຫ້າມຊໍ້າກັນ";
    seen.add(value);
  }

  if (record["16_topic"] != null && typeof record["16_topic"] !== "string") {
    return "ຂໍ້ມູນ Soft Skill ບໍ່ຖືກຕ້ອງ";
  }

  return null;
}

export async function GET() {
  const session = await getSession();
  const employee = session?.employee;
  if (!employee) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM odg_training_survey WHERE employee_code = $1 ORDER BY created_at DESC",
      [employee.employeeCode]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Failed to fetch training needs:", err);
    return jsonError("Failed to fetch training needs", 500);
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
    const { skill_priorities, fiscal_year } = body;
    if (!skill_priorities || !fiscal_year) {
      return jsonError("ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ", 400);
    }

    const skillPriorityError = validateSkillPriorities(skill_priorities);
    if (skillPriorityError) {
      return jsonError(skillPriorityError, 400);
    }

    const { rows: existingRows } = await pool.query(
      "SELECT id FROM odg_training_survey WHERE employee_code = $1 LIMIT 1",
      [employee.employeeCode]
    );
    if (existingRows.length > 0) {
      return jsonError("ທ່ານໄດ້ສົ່ງແບບສຳຫຼວດແລ້ວ ບໍ່ສາມາດສົ່ງຊ້ຳໄດ້", 409);
    }

    const normalizedSkillPriorities: Record<string, number | string> = {};
    const rawSkillPriorities = skill_priorities as Record<string, unknown>;
    for (const skillId of SKILL_IDS) {
      normalizedSkillPriorities[skillId] = rawSkillPriorities[skillId] as number;
    }
    if (
      typeof rawSkillPriorities["16_topic"] === "string" &&
      rawSkillPriorities["16_topic"].trim() !== ""
    ) {
      normalizedSkillPriorities["16_topic"] = rawSkillPriorities["16_topic"].trim();
    }

    const { rows } = await pool.query(
      `INSERT INTO odg_training_survey (employee_code, department_name, team_count, supervisor_years, skill_priorities, team_problems, suggested_course, fiscal_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        employee.employeeCode,
        body.department_name || null,
        body.team_count || null,
        ALLOWED_SUPERVISOR_YEARS.includes(body.supervisor_years) ? body.supervisor_years : null,
        JSON.stringify(normalizedSkillPriorities),
        body.team_problems || null,
        body.suggested_course || null,
        fiscal_year,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("Failed to create training need:", err);
    return jsonError("ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້", 500);
  }
}
