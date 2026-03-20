import pool from "@/lib/server/db";
import type { SessionData } from "@/lib/types";

const CRS_MANAGER_DEPARTMENT_CODES = new Set(["701", "801"]);
const CRS_SCHEMA_VERSION = 2;

declare global {
  var __hrmCrsSchemaState:
    | {
        version: number;
        promise: Promise<void>;
      }
    | undefined;
}

export interface CrsViewer {
  employeeCode: string;
  displayName: string;
  departmentCode: string | null;
  departmentName: string | null;
  positionCode: string | null;
  positionName: string | null;
  canManage: boolean;
}

function buildDisplayName(row: {
  title_lo: string | null;
  fullname_lo: string | null;
  employee_code: string;
}) {
  return `${row.title_lo ? `${row.title_lo} ` : ""}${row.fullname_lo || row.employee_code}`.trim();
}

export function canManageCrsDepartment(departmentCode: string | null | undefined) {
  return !!departmentCode && CRS_MANAGER_DEPARTMENT_CODES.has(String(departmentCode));
}

async function runCrsSchemaSetup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odg_crs_topic (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      location TEXT,
      scheduled_at TIMESTAMPTZ,
      created_by_employee_code TEXT NOT NULL,
      created_by_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    "ALTER TABLE odg_crs_topic ADD COLUMN IF NOT EXISTS image_url TEXT"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS odg_crs_registration (
      id BIGSERIAL PRIMARY KEY,
      topic_id BIGINT NOT NULL REFERENCES odg_crs_topic(id) ON DELETE CASCADE,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department_name TEXT,
      position_name TEXT,
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (topic_id, employee_code)
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS odg_crs_registration_topic_idx ON odg_crs_registration(topic_id)"
  );
}

export async function ensureCrsSchema() {
  const currentState = globalThis.__hrmCrsSchemaState;

  if (!currentState || currentState.version !== CRS_SCHEMA_VERSION) {
    const promise = runCrsSchemaSetup().catch((error) => {
      if (globalThis.__hrmCrsSchemaState?.version === CRS_SCHEMA_VERSION) {
        globalThis.__hrmCrsSchemaState = undefined;
      }
      throw error;
    });

    globalThis.__hrmCrsSchemaState = {
      version: CRS_SCHEMA_VERSION,
      promise,
    };
  }

  return globalThis.__hrmCrsSchemaState!.promise;
}

export async function getCrsViewer(session: SessionData | null) {
  if (!session) return null;

  const lookupSql = session.employee
    ? `SELECT e.employee_code, e.title_lo, e.fullname_lo, e.department_code, d.department_name_lo, e.position_code, p.position_name_lo
       FROM odg_employee e
       LEFT JOIN odg_department d ON d.department_code = e.department_code
       LEFT JOIN odg_position p ON p.position_code = e.position_code
       WHERE e.employee_code = $1
       LIMIT 1`
    : `SELECT e.employee_code, e.title_lo, e.fullname_lo, e.department_code, d.department_name_lo, e.position_code, p.position_name_lo
       FROM odg_employee e
       LEFT JOIN odg_department d ON d.department_code = e.department_code
       LEFT JOIN odg_position p ON p.position_code = e.position_code
       WHERE e.line_id = $1
       LIMIT 1`;

  const lookupValue = session.employee?.employeeCode || session.lineUserId;
  const { rows } = await pool.query(lookupSql, [lookupValue]);
  const row = rows[0];

  if (!row) return null;

  return {
    employeeCode: row.employee_code,
    displayName: buildDisplayName(row),
    departmentCode: row.department_code ?? null,
    departmentName: row.department_name_lo ?? null,
    positionCode: row.position_code ?? null,
    positionName: row.position_name_lo ?? null,
    canManage: canManageCrsDepartment(row.department_code ?? null),
  } satisfies CrsViewer;
}
