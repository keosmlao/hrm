import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SessionData } from "@/lib/types";

const SESSION_COOKIE_NAME = "session";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET or LINE_CHANNEL_SECRET must be configured");
  }
  return secret;
}

function signSessionPayload(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeSession(session: SessionData) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = signSessionPayload(payload, getSessionSecret());
  return `${payload}.${signature}`;
}

function decodeSession(rawValue: string): SessionData | null {
  const [payload, signature] = rawValue.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signSessionPayload(payload, getSessionSecret());
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawSession) return null;

  try {
    return decodeSession(rawSession);
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, session: SessionData) {
  response.cookies.set(SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
