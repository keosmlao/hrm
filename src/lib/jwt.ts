import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE" | "EXECUTIVE";

export type SessionPayload = {
  userId: string;
  username: string;
  role: Role;
  /** ລະຫັດພະນັກງານ (odg_employee.employee_code) — null ຖ້າບັນຊີບໍ່ຜູກກັບພະນັກງານ */
  employeeCode: string | null;
  name: string;
};

export const COOKIE_NAME = "hrm_session";
export const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 ຊົ່ວໂມງ

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET ຕ້ອງມີຢ່າງໜ້ອຍ 32 ຕົວອັກສອນ");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
