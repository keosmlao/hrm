import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { setSessionCookie } from "@/lib/server/session";
import { verifyLineOAuthState } from "@/lib/line-oauth-state";
import { getPublicOrigin, getPublicUrl, isLocalHost } from "@/lib/public-url";
import type { SessionData } from "@/lib/types";

const LINE_PLACEHOLDER_VALUES = new Set([
  "your_line_channel_id",
  "your_line_channel_secret",
  "your_line_callback_url",
]);

function isConfiguredValue(value: string | undefined) {
  if (!value) return false;
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 && !LINE_PLACEHOLDER_VALUES.has(trimmedValue);
}

function getCallbackUrl(request: NextRequest) {
  const publicOrigin = getPublicOrigin(request);
  const publicHostname = new URL(publicOrigin).hostname;

  if (process.env.NODE_ENV !== "production" && isLocalHost(publicHostname)) {
    return new URL("/api/auth/line/callback", publicOrigin).toString();
  }

  if (isConfiguredValue(process.env.LINE_CALLBACK_URL)) {
    return process.env.LINE_CALLBACK_URL!;
  }

  return new URL("/api/auth/line/callback", publicOrigin).toString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (error || !code) {
    return NextResponse.redirect(getPublicUrl(request, "/login?error=access_denied"));
  }

  if (!isConfiguredValue(channelId) || !isConfiguredValue(channelSecret)) {
    return NextResponse.redirect(getPublicUrl(request, "/login?error=config_missing"));
  }

  if (!state || !verifyLineOAuthState(state, channelSecret!)) {
    return NextResponse.redirect(getPublicUrl(request, "/login?error=invalid_state"));
  }

  try {
    const callbackUrl = getCallbackUrl(request);
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: channelId!,
        client_secret: channelSecret!,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(getPublicUrl(request, "/login?error=token_failed"));
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      return NextResponse.redirect(getPublicUrl(request, "/login?error=profile_failed"));
    }

    const profile = await profileResponse.json() as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

    let employee = null;
    try {
      const { rows } = await pool.query(
        "SELECT * FROM odg_employee WHERE line_id = $1 LIMIT 1",
        [profile.userId]
      );
      employee = rows[0] || null;
    } catch (err: unknown) {
      const errorCode =
        err && typeof err === "object" && "code" in err ? String(err.code) : null;

      if (errorCode === "ENOTFOUND" || errorCode === "ECONNREFUSED") {
        console.error("LINE callback database connection error:", err);
        return NextResponse.redirect(getPublicUrl(request, "/login?error=db_unreachable"));
      }

      throw err;
    }

    const sessionData: SessionData = {
      lineUserId: profile.userId,
      lineDisplayName: profile.displayName,
      linePictureUrl: profile.pictureUrl || null,
      employee: employee
        ? {
            employeeId: employee.employee_id,
            employeeCode: employee.employee_code,
            fullnameLo: employee.fullname_lo,
            fullnameEn: employee.fullname_en,
            titleLo: employee.title_lo,
            titleEn: employee.title_en,
            nickname: employee.nickname,
            positionCode: employee.position_code,
            divisionCode: employee.division_code,
            departmentCode: employee.department_code,
            unitCode: employee.unit_code,
            hireDate: employee.hire_date,
            employmentStatus: employee.employment_status,
          }
        : null,
    };

    const response = NextResponse.redirect(getPublicUrl(request, "/home"));
    setSessionCookie(response, sessionData);
    return response;
  } catch (err) {
    console.error("LINE callback error:", err);
    return NextResponse.redirect(getPublicUrl(request, "/login?error=server_error"));
  }
}
