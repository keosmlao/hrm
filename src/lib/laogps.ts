import "server-only";

/**
 * Lao GPS Tracker — Open API v1 client (read-only).
 *
 * ໃຊ້ username/password ຂອງ web portal gps.laogpstracker.com (ໃສ່ໃນ .env) —
 * ຊື່ຕົວແປຕາມແບບໂປຣເຈັກ TMS ເພື່ອບໍ່ໃຫ້ສັບສົນຂ້າມແອັບ:
 *   GPS_OPENAPI_USER=...
 *   GPS_OPENAPI_PASS=...
 *   GPS_OPENAPI_URL=...   (ບໍ່ບັງຄັບ — default ຄື production)
 *
 * ⚠️ ຢ່າໃຊ້ GPS_TRACKER_USER/PASS: ນັ້ນເປັນບັນຊີຂອງ apis.thaigpstracker.co.th
 * (ຂອງເກົ່າ) ເຊິ່ງ Lao GPS ປະຕິເສດດ້ວຍ 401 INVALID_CREDENTIALS — ທົດສອບແລ້ວ
 * ທັງຢູ່ TMS ແລະ ຢູ່ນີ້. login ຜິດ 10 ເທື່ອ/15 ນາທີ ຈະຖືກລັອກທັງບັນຊີ.
 *
 * ຕົວ `{id}` ຂອງ endpoint ຮັບໄດ້ທັງ `vehicle_id` ແລະ `imei` —
 * ຝັ່ງ HRM ເກັບ `app_car_vehicles.gps_imei` ຢູ່ແລ້ວ ຈຶ່ງສົ່ງ IMEI ໄປໂດຍກົງໄດ້.
 *
 * ໝາຍເຫດນ້ຳມັນ: ໃຊ້ `fuel_used_litre` ເທົ່ານັ້ນ —
 * ຫ້າມບວກ `points[].fuel_percent` ເອງ (ດິບ, ມີການເຕີມນ້ຳມັນ/ສັນຍານແກວ່ງປົນ).
 */

const DEFAULT_BASE_URL = "https://gps.laogpstracker.com/api2/public/openapi/v1";

/** ອາຍຸ token ທີ່ຂໍ (ວິນາທີ) — API ຮັບ 300–86400 */
const TOKEN_TTL_SECONDS = 43200;
/** ຂໍ token ໃໝ່ກ່ອນໝົດອາຍຸ (ມິນລິວິນາທີ) */
const TOKEN_SKEW_MS = 60_000;
/**
 * login ຜິດແລ້ວຢຸດລອງດົນເທົ່າໃດ — provider ລັອກທີ່ 10 ເທື່ອ/15 ນາທີ
 * ຕໍ່ username+IP. ຖ້າບໍ່ມີກັນນີ້ ຜູ້ໃຊ້ກົດປຸ່ມຊ້ຳໆ ຈະລັອກທັງບັນຊີ.
 */
const LOGIN_COOLDOWN_MS = 15 * 60_000;

// ── ປະເພດຂໍ້ມູນ ─────────────────────────────────────────────────────────────

export type FuelCapability = {
  supported: boolean;
  method: "rate" | "sensor" | null;
  reason: string | null;
  tank_litre: number | null;
  km_per_litre: number | null;
};

export type LaoGpsVehicle = {
  vehicle_id: number;
  imei: string;
  name: string | null;
  plate: string | null;
  province: string | null;
  chassis: string | null;
  car_model: string | null;
  category: string | null;
  asset: string | null;
  device_model: string | null;
  sim: string | null;
  active: boolean;
  has_camera: boolean;
  overspeed_kmh: number | null;
  park_limit_min: number | null;
  expire_date: string | null;
  registered_at: string | null;
  last_seen_at: string | null;
  last_position: { latitude: number | null; longitude: number | null } | null;
  fuel_capability: FuelCapability;
};

export type LaoGpsPosition = {
  vehicle_id: number;
  imei: string;
  plate: string | null;
  name: string | null;
  time: string | null;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  direction: string | null;
  engine_on: boolean;
  mileage_km: number | null;
  address: string | null;
  fuel_percent: number | null;
  fuel_litre: number | null;
  source: "live" | "cached";
};

export type LaoGpsTrackPoint = {
  time: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  direction: string | null;
  engine_on: boolean;
  mileage_km: number | null;
  address: string | null;
  /** ຄ່າດິບຈາກອຸປະກອນ — ຫ້າມເອົາໄປບວກເປັນຍອດການໃຊ້ນ້ຳມັນ */
  fuel_percent: number | null;
  fuel_litre: number | null;
};

export type LaoGpsHistory = {
  vehicle: LaoGpsVehicle;
  from: string;
  to: string;
  summary: {
    points: number;
    trips: number;
    distance_km: number;
    max_speed_kmh: number;
    drive_hours: number;
    idle_hours: number;
    parked_hours: number;
    overspeed_count: number;
  };
  fuel: {
    used_litre: number | null;
    used_percent: number | null;
    method: "rate" | "sensor" | null;
    tank_litre: number | null;
    km_per_litre: number | null;
    sample_count: number;
    clamped: boolean;
    reason: string | null;
    note?: string;
  };
  points: LaoGpsTrackPoint[];
};

export type LaoGpsHistoryMeta = {
  points_total?: number;
  points_returned?: number;
  truncated?: boolean;
  max_points?: number;
  next_from?: string;
  truncation_note?: string;
};

export type LaoGpsFuel = {
  vehicle_id: number;
  imei: string;
  plate: string | null;
  name: string | null;
  distance_km: number;
  drive_hours: number;
  idle_hours: number;
  /** ຕົວເລກທີ່ຖືກຕ້ອງ — null ໝາຍວ່າລົດຄັນນີ້ລາຍງານນ້ຳມັນບໍ່ໄດ້ (ເບິ່ງ fuel_reason) */
  fuel_used_litre: number | null;
  fuel_used_percent: number | null;
  /** sensor-model + ຫຼາຍວັນເທົ່ານັ້ນ — ໃຊ້ອັນນີ້ເປັນຍອດລວມຫຼາຍວັນ */
  fuel_used_litre_daily_sum: number | null;
  fuel_method: "rate" | "sensor" | null;
  fuel_reason: string | null;
  tank_litre: number | null;
  km_per_litre: number | null;
  moving_litre: number | null;
  redlight_litre: number | null;
  idle_litre: number | null;
  clamped: boolean;
  sample_count: number;
  partial_data: boolean;
  daily?: {
    day: string;
    distance_km: number;
    drive_hours: number;
    fuel_used_litre: number | null;
    fuel_method: "rate" | "sensor" | null;
    sample_count: number;
  }[];
};

export type LaoGpsFuelTotals = {
  fuel_used_litre: number | null;
  distance_km: number;
  vehicles_with_fuel: number;
  vehicles_without_fuel: number;
};

export type LaoGpsDriverBehaviour = {
  vehicle_id: number;
  imei: string;
  plate: string | null;
  name: string | null;
  safety_score: number;
  eco_score: number;
  overspeed_count: number;
  dashcam_event_count: number;
  long_idle_hours: number;
  long_idle_sessions: number;
  long_idle_fuel_litre: number;
  redlight_hours: number;
  redlight_fuel_litre: number;
  trips: number;
  distance_km: number;
  drive_hours: number;
  travel_hours: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  idle_hours: number;
  idle_sessions: number;
  parked_hours: number;
  parked_sessions: number;
  fuel_litre: number | null;
  km_per_litre: number | null;
  km_per_litre_total: number | null;
  has_camera: boolean;
};

type Envelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: Record<string, unknown> | null;
};

/** ຜົນລັບ + meta ຂອງ envelope (ບາງ endpoint ໃສ່ຂໍ້ມູນສຳຄັນໄວ້ໃນ meta) */
export type WithMeta<T, M = Record<string, unknown>> = { data: T; meta: M };

// ── Error ───────────────────────────────────────────────────────────────────

export class LaoGpsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LaoGpsError";
  }
}

/** ຄຳອະທິບາຍພາສາລາວຂອງລະຫັດ error ທີ່ພົບເລື້ອຍ */
export const LAOGPS_ERROR_LABEL: Record<string, string> = {
  INVALID_REQUEST: "ຄຳຂໍບໍ່ຖືກຕ້ອງ",
  INVALID_VEHICLE_ID: "ລະຫັດລົດບໍ່ຖືກຕ້ອງ",
  INVALID_RANGE: "ຊ່ວງວັນທີບໍ່ຖືກຕ້ອງ ຫຼື ກວ້າງເກີນກຳນົດ",
  UNAUTHENTICATED: "ບໍ່ໄດ້ສົ່ງ token",
  TOKEN_INVALID: "Token ບໍ່ຖືກຕ້ອງ",
  TOKEN_EXPIRED: "Token ໝົດອາຍຸ",
  INVALID_CREDENTIALS: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານ LaoGPS ບໍ່ຖືກຕ້ອງ",
  ACCOUNT_SUSPENDED: "ບັນຊີ LaoGPS ຖືກລະງັບ",
  VEHICLE_NOT_FOUND: "ບໍ່ພົບລົດຄັນນີ້ໃນບັນຊີ LaoGPS",
  NOT_FOUND: "ບໍ່ພົບ endpoint",
  TOO_MANY_ATTEMPTS: "ລອງເຂົ້າລະບົບຫຼາຍເກີນໄປ — ລໍຖ້າແລ້ວລອງໃໝ່",
  INTERNAL_ERROR: "ເຊີບເວີ LaoGPS ຜິດພາດ",
  TRACKING_STORE_ERROR: "ອ່ານຖານຂໍ້ມູນ tracking ບໍ່ໄດ້",
  REPORT_FAILED: "ຄຳນວນຄະແນນຄົນຂັບບໍ່ສຳເລັດ",
  SERVICE_UNAVAILABLE: "ບໍລິການ token ບໍ່ພ້ອມໃຊ້ງານ",
  NO_CREDENTIALS: "ຍັງບໍ່ໄດ້ຕັ້ງ GPS_OPENAPI_USER / GPS_OPENAPI_PASS ໃນ .env",
  LOGIN_COOLDOWN: "login ຜິດກ່ອນໜ້ານີ້ — ຢຸດລອງຊົ່ວຄາວ ເພື່ອບໍ່ໃຫ້ບັນຊີຖືກລັອກ",
};

export function laoGpsErrorMessage(e: unknown): string {
  if (e instanceof LaoGpsError) return LAOGPS_ERROR_LABEL[e.code] ?? e.message;
  return e instanceof Error ? e.message : String(e);
}

/** ຕັ້ງ credentials ແລ້ວບໍ — ໃຫ້ໜ້າ UI ກວດກ່ອນເອີ້ນ */
export function laoGpsConfigured(): boolean {
  return Boolean(process.env.GPS_OPENAPI_USER && process.env.GPS_OPENAPI_PASS);
}

// ── Token ───────────────────────────────────────────────────────────────────

type CachedToken = { token: string; expiresAtMs: number };

let cachedToken: CachedToken | null = null;
let inFlightLogin: Promise<CachedToken> | null = null;
/** ຫ້າມ login ຈົນຮອດເວລານີ້ — ຕັ້ງເມື່ອ credentials ຖືກປະຕິເສດ */
let blockedUntilMs = 0;

function baseUrl(): string {
  return (process.env.GPS_OPENAPI_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function login(): Promise<CachedToken> {
  const username = process.env.GPS_OPENAPI_USER;
  const password = process.env.GPS_OPENAPI_PASS;
  if (!username || !password) {
    throw new LaoGpsError("NO_CREDENTIALS", LAOGPS_ERROR_LABEL.NO_CREDENTIALS, 0);
  }
  if (Date.now() < blockedUntilMs) {
    const wait = Math.ceil((blockedUntilMs - Date.now()) / 60_000);
    throw new LaoGpsError(
      "LOGIN_COOLDOWN",
      `${LAOGPS_ERROR_LABEL.LOGIN_COOLDOWN} (ອີກ ~${wait} ນາທີ)`,
      0,
    );
  }

  const res = await fetch(`${baseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, expires_in: TOKEN_TTL_SECONDS }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as Envelope<{
    token: string;
    expires_at: string;
    expires_in: number;
  }> | null;

  if (!res.ok || !body?.success || !body.data?.token) {
    const code = body?.error?.code ?? "INTERNAL_ERROR";
    // credentials ຜິດ/ບັນຊີມີບັນຫາ → ຢຸດລອງຍາວ, ຢ່າຍິງຊ້ຳຈົນຖືກລັອກ
    if (["INVALID_CREDENTIALS", "ACCOUNT_SUSPENDED", "TOO_MANY_ATTEMPTS"].includes(code)) {
      blockedUntilMs = Date.now() + LOGIN_COOLDOWN_MS;
    }
    throw new LaoGpsError(code, body?.error?.message ?? `login failed (HTTP ${res.status})`, res.status);
  }
  blockedUntilMs = 0;

  const expiresAtMs = Date.parse(body.data.expires_at);
  return {
    token: body.data.token,
    expiresAtMs: Number.isFinite(expiresAtMs)
      ? expiresAtMs
      : Date.now() + (body.data.expires_in ?? TOKEN_TTL_SECONDS) * 1000,
  };
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs - TOKEN_SKEW_MS > Date.now()) {
    return cachedToken.token;
  }
  // ຮວມການ login ທີ່ຍິງພ້ອມກັນໃຫ້ເປັນຄັ້ງດຽວ (login ຜິດຊ້ຳໆ ຈະຕິດ throttle)
  inFlightLogin ??= login()
    .then((t) => {
      cachedToken = t;
      return t;
    })
    .finally(() => {
      inFlightLogin = null;
    });
  return (await inFlightLogin).token;
}

// ── ຕົວເອີ້ນກາງ ─────────────────────────────────────────────────────────────

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

type RawResult<T> = { status: number; body: Envelope<T> };

async function callOnce<T>(url: string, token: string): Promise<RawResult<T>> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!body) {
    throw new LaoGpsError("INTERNAL_ERROR", `ຕອບກັບບໍ່ແມ່ນ JSON (HTTP ${res.status})`, res.status);
  }
  return { status: res.status, body };
}

/** ເອີ້ນ endpoint — ຈັດການ token ໝົດອາຍຸ (ລອງ login ໃໝ່ 1 ຄັ້ງ) ແລະ envelope ໃຫ້ */
async function call<T>(path: string, query?: Query): Promise<RawResult<T>> {
  const url = buildUrl(path, query);
  let result = await callOnce<T>(url, await getToken());

  if (
    result.status === 401 &&
    (result.body.error?.code === "TOKEN_EXPIRED" || result.body.error?.code === "TOKEN_INVALID")
  ) {
    cachedToken = null;
    result = await callOnce<T>(url, await getToken());
  }

  if (result.status >= 400 || result.body.success === false) {
    throw new LaoGpsError(
      result.body.error?.code ?? "INTERNAL_ERROR",
      result.body.error?.message ?? `HTTP ${result.status}`,
      result.status,
    );
  }
  return result;
}

async function get<T>(path: string, query?: Query): Promise<T> {
  const { body } = await call<T>(path, query);
  return body.data as T;
}

async function getWithMeta<T, M = Record<string, unknown>>(
  path: string,
  query?: Query,
): Promise<WithMeta<T, M>> {
  const { body } = await call<T>(path, query);
  return { data: body.data as T, meta: (body.meta ?? {}) as M };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ງົບເວລາລໍລາຍງານທີ່ຕອບ 202 — ຕັ້ງດ້ວຍ GPS_OPENAPI_POLL_SECONDS (cron ຕັ້ງໃຫ້ຍາວໄດ້) */
const LAOGPS_POLL_BUDGET_MS = (Number(process.env.GPS_OPENAPI_POLL_SECONDS) || 55) * 1000;

/**
 * ເອີ້ນ endpoint ທີ່ອາດຕອບ HTTP 202 (ກຳລັງຄຳນວນຢູ່ເບື້ອງຫຼັງ) —
 * ຍິງຄຳຂໍເດີມຊ້ຳຈົນໄດ້ຜົນ ຫຼື ໝົດເວລາ budgetMs (ນັບລວມທັງເວລາລໍ ແລະ ເວລາຂອງຄຳຂໍ).
 * ໜ້າເວັບໃຊ້ budget ສັ້ນ (ຜູ້ໃຊ້ລໍຢູ່) · cron/script ສົ່ງ budget ຍາວໄດ້.
 */
async function getPolling<T>(path: string, query: Query, budgetMs = LAOGPS_POLL_BUDGET_MS): Promise<T> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const { status, body } = await call<T>(path, query);
    if (status !== 202 && body.data != null) return body.data;
    const retryAfter = Number((body.meta as Record<string, unknown>)?.retry_after_seconds) || 5;
    const waitMs = Math.min(retryAfter, 10) * 1000;
    if (Date.now() + waitMs >= deadline) break;
    await sleep(waitMs);
  }
  throw new LaoGpsError(
    "REPORT_FAILED",
    "LaoGPS ຍັງຄຳນວນບໍ່ແລ້ວ — ລອງໃໝ່ອີກໜ້ອຍໜຶ່ງ ຫຼື ຫຼຸດຊ່ວງວັນທີ/ຈຳນວນລົດ",
    202,
  );
}

// ── Endpoints ───────────────────────────────────────────────────────────────

export type MeInfo = {
  username: string;
  user_id: number;
  usergroup_id: number;
  token: { issued_at: string; expires_at: string };
};

/** ຢືນຢັນວ່າ token ເປັນຂອງບັນຊີໃດ — ໃຊ້ທົດສອບການເຊື່ອມຕໍ່ */
export function me(): Promise<MeInfo> {
  return get<MeInfo>("/auth/me");
}

/** ລາຍການລົດທັງໝົດໃນບັນຊີ LaoGPS */
export function listVehicles(opts?: {
  activeOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<LaoGpsVehicle[]> {
  return get<LaoGpsVehicle[]>("/vehicles", {
    active_only: opts?.activeOnly,
    search: opts?.search,
    limit: opts?.limit,
    offset: opts?.offset,
  });
}

/** ລົດຄັນດຽວ — `id` ໃສ່ໄດ້ທັງ vehicle_id ແລະ IMEI */
export function getVehicle(id: string | number): Promise<LaoGpsVehicle> {
  return get<LaoGpsVehicle>(`/vehicles/${id}`);
}

/** ຕຳແໜ່ງລ່າສຸດຂອງລົດທຸກຄັນ */
export function listPositions(opts?: { activeOnly?: boolean }): Promise<LaoGpsPosition[]> {
  return get<LaoGpsPosition[]>("/positions", { active_only: opts?.activeOnly });
}

/** ຕຳແໜ່ງລ່າສຸດຂອງລົດຄັນດຽວ */
export function getPosition(id: string | number): Promise<LaoGpsPosition> {
  return get<LaoGpsPosition>(`/vehicles/${id}/position`);
}

/**
 * ປະຫວັດເສັ້ນທາງ (ສູງສຸດ 31 ວັນ, 20000 ຈຸດຕໍ່ຄຳຂໍ).
 * ຖ້າຈຸດເກີນ 20000 → `meta.truncated = true` ພ້ອມ `meta.next_from` ໃຫ້ຂໍຕໍ່.
 * `summary` ແລະ `fuel` ຄຸມຊ່ວງເຕັມສະເໝີ ເຖິງວ່າ points ຈະຖືກຕັດ.
 */
export function getHistory(
  id: string | number,
  opts: { from: string; to: string; includePoints?: boolean; limit?: number },
): Promise<WithMeta<LaoGpsHistory, LaoGpsHistoryMeta>> {
  return getWithMeta<LaoGpsHistory, LaoGpsHistoryMeta>(`/vehicles/${id}/history`, {
    from: opts.from,
    to: opts.to,
    include_points: opts.includePoints,
    limit: opts.limit,
  });
}

/** ນ້ຳມັນລົດຄັນດຽວ (ສູງສຸດ 31 ວັນ) */
export function getFuel(
  id: string | number,
  opts: { from: string; to: string; daily?: boolean },
): Promise<LaoGpsFuel> {
  return get<LaoGpsFuel>(`/vehicles/${id}/fuel`, {
    from: opts.from,
    to: opts.to,
    daily: opts.daily,
  });
}

/** ນ້ຳມັນລົດທຸກຄັນ (ສູງສຸດ 7 ວັນ — endpoint ນີ້ອ່ານ tracking store ທຸກຄັນທຸກວັນ) */
export function listFuel(opts: {
  from: string;
  to: string;
}): Promise<WithMeta<LaoGpsFuel[], { totals?: LaoGpsFuelTotals }>> {
  return getWithMeta<LaoGpsFuel[], { totals?: LaoGpsFuelTotals }>("/fuel", {
    from: opts.from,
    to: opts.to,
  });
}

/**
 * ຄະແນນຄົນຂັບ ທຸກຄັນ (ສູງສຸດ 31 ວັນ).
 * ຊ່ວງກວ້າງ × ລົດຫຼາຍຄັນ ຈະຄຳນວນເບື້ອງຫຼັງ — ຟັງຊັນນີ້ຍິງຊ້ຳໃຫ້ຈົນໄດ້ຜົນ.
 * ໝາຍເຫດ: ຄະແນນເປັນ **ຕໍ່ລົດ** ບໍ່ແມ່ນຕໍ່ຄົນຂັບ — ຕ້ອງຜູກກັບ trip ຂອງ HRM ເອງ.
 */
export function listDriverBehaviour(opts: {
  from: string;
  to: string;
  timeFrom?: string;
  timeTo?: string;
  /** ງົບເວລາລໍ (ms) — ໃສ່ຍາວກວ່າປົກກະຕິໄດ້ໃນ cron/script */
  budgetMs?: number;
}): Promise<LaoGpsDriverBehaviour[]> {
  return getPolling<LaoGpsDriverBehaviour[]>("/driver-behaviour", {
    from: opts.from,
    to: opts.to,
    time_from: opts.timeFrom,
    time_to: opts.timeTo,
  }, opts.budgetMs);
}

/** ຄະແນນຄົນຂັບ ລົດຄັນດຽວ */
export function getDriverBehaviour(
  id: string | number,
  opts: { from: string; to: string; timeFrom?: string; timeTo?: string },
): Promise<LaoGpsDriverBehaviour> {
  return getPolling<LaoGpsDriverBehaviour>(`/vehicles/${id}/driver-behaviour`, {
    from: opts.from,
    to: opts.to,
    time_from: opts.timeFrom,
    time_to: opts.timeTo,
  });
}

// ── ຕົວຊ່ວຍ ─────────────────────────────────────────────────────────────────

/**
 * ຍອດນ້ຳມັນທີ່ຄວນສະແດງ:
 * ລົດແບບ sensor ຫຼາຍວັນ → ໃຊ້ `fuel_used_litre_daily_sum` (ຈິງກວ່າ),
 * ນອກນັ້ນ → `fuel_used_litre`. ຄືນ null ຖ້າວັດບໍ່ໄດ້ (ຢ່າແທນດ້ວຍ 0).
 */
export function fuelLitreForDisplay(f: LaoGpsFuel): number | null {
  if (f.fuel_method === "sensor" && f.fuel_used_litre_daily_sum != null) {
    return f.fuel_used_litre_daily_sum;
  }
  return f.fuel_used_litre;
}

export const FUEL_REASON_LABEL: Record<string, string> = {
  NO_TANK_SIZE: "ບໍ່ໄດ້ຕັ້ງຂະໜາດຖັງ",
  NO_SENSOR_CALIBRATION: "ບໍ່ໄດ້ຕັ້ງຄ່າເຊັນເຊີນ້ຳມັນ",
  NO_TANK_SIZE_AND_NO_SENSOR_CALIBRATION: "ບໍ່ໄດ້ຕັ້ງທັງຖັງ ແລະ ເຊັນເຊີ",
  NOT_ENOUGH_SENSOR_READINGS: "ຄ່າເຊັນເຊີບໍ່ພຽງພໍ (ອຸປະກອນ offline)",
  SENSOR_READINGS_UNUSABLE: "ຄ່າເຊັນເຊີໃຊ້ບໍ່ໄດ້",
};

export function fuelReasonLabel(reason: string | null): string {
  if (!reason) return "—";
  return FUEL_REASON_LABEL[reason] ?? reason;
}
