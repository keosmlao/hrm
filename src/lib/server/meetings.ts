import pool from "@/lib/server/db";
import type { SessionData } from "@/lib/types";

const MEETINGS_SCHEMA_VERSION = 3;
const IT_DEPARTMENT_CODES = new Set(["801"]);

declare global {
  var __hrmMeetingsSchemaState:
    | { version: number; promise: Promise<void> }
    | undefined;
}

export interface MeetingsViewer {
  employeeCode: string;
  displayName: string;
  departmentCode: string | null;
  departmentName: string | null;
  positionCode: string | null;
  positionName: string | null;
  lineUserId: string | null;
  isIT: boolean;
  isOrganizer: boolean;
}

function buildDisplayName(row: {
  title_lo: string | null;
  fullname_lo: string | null;
  employee_code: string;
}) {
  return `${row.title_lo ? `${row.title_lo} ` : ""}${row.fullname_lo || row.employee_code}`.trim();
}

async function runMeetingsSchemaSetup() {
  // Organizers — IT assigns who can create meetings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odg_meeting_organizer (
      id BIGSERIAL PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      employee_name TEXT,
      assigned_by_code TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Meetings — created by organizers
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odg_meeting (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      meeting_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      created_by_code TEXT NOT NULL,
      created_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Participants — invited/assigned by organizer
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odg_meeting_participant (
      id BIGSERIAL PRIMARY KEY,
      meeting_id BIGINT NOT NULL REFERENCES odg_meeting(id) ON DELETE CASCADE,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department_name TEXT,
      position_name TEXT,
      notified BOOLEAN NOT NULL DEFAULT FALSE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (meeting_id, employee_code)
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS odg_meeting_participant_meeting_idx ON odg_meeting_participant(meeting_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS odg_meeting_participant_emp_idx ON odg_meeting_participant(employee_code)"
  );
  await pool.query(
    "ALTER TABLE odg_meeting_participant ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT FALSE"
  );
  await pool.query(
    "ALTER TABLE odg_meeting_participant ADD COLUMN IF NOT EXISTS response_status TEXT NOT NULL DEFAULT 'pending'"
  );
  await pool.query(
    "ALTER TABLE odg_meeting_participant ADD COLUMN IF NOT EXISTS response_reason TEXT"
  );
  await pool.query(
    "ALTER TABLE odg_meeting_participant ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ"
  );
}

export async function ensureMeetingsSchema() {
  const currentState = globalThis.__hrmMeetingsSchemaState;

  if (!currentState || currentState.version !== MEETINGS_SCHEMA_VERSION) {
    const promise = runMeetingsSchemaSetup().catch((error) => {
      if (globalThis.__hrmMeetingsSchemaState?.version === MEETINGS_SCHEMA_VERSION) {
        globalThis.__hrmMeetingsSchemaState = undefined;
      }
      throw error;
    });

    globalThis.__hrmMeetingsSchemaState = {
      version: MEETINGS_SCHEMA_VERSION,
      promise,
    };
  }

  return globalThis.__hrmMeetingsSchemaState!.promise;
}

export async function getMeetingsViewer(session: SessionData | null): Promise<MeetingsViewer | null> {
  if (!session) return null;

  const lookupSql = session.employee
    ? `SELECT e.employee_code, e.title_lo, e.fullname_lo, e.department_code, d.department_name_lo, e.position_code, p.position_name_lo, e.line_id
       FROM odg_employee e
       LEFT JOIN odg_department d ON d.department_code = e.department_code
       LEFT JOIN odg_position p ON p.position_code = e.position_code
       WHERE e.employee_code = $1
       LIMIT 1`
    : `SELECT e.employee_code, e.title_lo, e.fullname_lo, e.department_code, d.department_name_lo, e.position_code, p.position_name_lo, e.line_id
       FROM odg_employee e
       LEFT JOIN odg_department d ON d.department_code = e.department_code
       LEFT JOIN odg_position p ON p.position_code = e.position_code
       WHERE e.line_id = $1
       LIMIT 1`;

  const lookupValue = session.employee?.employeeCode || session.lineUserId;
  const { rows } = await pool.query(lookupSql, [lookupValue]);
  const row = rows[0];
  if (!row) return null;

  const employeeCode = row.employee_code;
  const departmentCode = row.department_code ?? null;
  const isIT = !!departmentCode && IT_DEPARTMENT_CODES.has(String(departmentCode));

  // Check if assigned as organizer
  let isAssignedOrganizer = false;
  try {
    const { rows: orgRows } = await pool.query(
      "SELECT id FROM odg_meeting_organizer WHERE employee_code = $1 LIMIT 1",
      [employeeCode]
    );
    isAssignedOrganizer = orgRows.length > 0;
  } catch {
    // Table may not exist yet — treat as not assigned
    console.warn("[Meetings] odg_meeting_organizer query failed, treating as not organizer");
  }

  console.log("[Meetings] viewer:", employeeCode, "dept:", departmentCode, "isIT:", isIT, "isAssignedOrganizer:", isAssignedOrganizer);

  return {
    employeeCode,
    displayName: buildDisplayName(row),
    departmentCode,
    departmentName: row.department_name_lo ?? null,
    positionCode: row.position_code ?? null,
    positionName: row.position_name_lo ?? null,
    lineUserId: row.line_id ?? null,
    isIT,
    isOrganizer: isAssignedOrganizer,
  };
}

/** Get LINE user ID for an employee */
export async function getEmployeeLineId(employeeCode: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT line_id FROM odg_employee WHERE employee_code = $1 LIMIT 1",
    [employeeCode]
  );
  return rows[0]?.line_id ?? null;
}

/** Lookup employee info for adding as participant */
export async function lookupEmployee(employeeCode: string) {
  const { rows } = await pool.query(
    `SELECT e.employee_code, e.title_lo, e.fullname_lo, e.line_id,
            d.department_name_lo, p.position_name_lo
     FROM odg_employee e
     LEFT JOIN odg_department d ON d.department_code = e.department_code
     LEFT JOIN odg_position p ON p.position_code = e.position_code
     WHERE e.employee_code = $1
     LIMIT 1`,
    [employeeCode]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    employeeCode: r.employee_code,
    displayName: buildDisplayName(r),
    departmentName: r.department_name_lo ?? null,
    positionName: r.position_name_lo ?? null,
    lineId: r.line_id ?? null,
  };
}
