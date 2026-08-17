import "server-only";
import { cookies, headers } from "next/headers";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  decryptSession,
  encryptSession,
  type SessionPayload,
} from "./jwt";

export type { SessionPayload, Role } from "./jwt";
export { COOKIE_NAME } from "./jwt";

async function shouldUseSecureCookie() {
  const configured = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;

  // Reverse proxies normally send this header. Direct local/LAN HTTP does not,
  // so its cookie must remain usable even when the app runs via `next start`.
  const forwardedProto = (await headers())
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim()
    .toLowerCase();

  return forwardedProto === "https" || process.env.VERCEL === "1";
}

export async function createSession(payload: SessionPayload) {
  const token = await encryptSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: await shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decryptSession(store.get(COOKIE_NAME)?.value);
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
