import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyLineOAuthState } from "@/lib/line-oauth-state";
import { getPublicOrigin, getPublicUrl, isLocalHost } from "@/lib/public-url";

interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

function getCallbackUrl(request: NextRequest) {
  const publicOrigin = getPublicOrigin(request);
  const publicHostname = new URL(publicOrigin).hostname;

  if (process.env.NODE_ENV !== "production" && isLocalHost(publicHostname)) {
    return new URL("/api/auth/line/callback", publicOrigin).toString();
  }

  return process.env.LINE_CALLBACK_URL || new URL("/api/auth/line/callback", publicOrigin).toString();
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

  if (!channelId || !channelSecret) {
    return NextResponse.redirect(getPublicUrl(request, "/login?error=config_missing"));
  }

  if (!state || !verifyLineOAuthState(state, channelSecret)) {
    return NextResponse.redirect(getPublicUrl(request, "/login?error=invalid_state"));
  }

  try {
    const callbackUrl = getCallbackUrl(request);

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(getPublicUrl(request, "/login?error=token_failed"));
    }

    const tokenData: LineTokenResponse = await tokenResponse.json();

    // Get user profile from LINE
    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      return NextResponse.redirect(getPublicUrl(request, "/login?error=profile_failed"));
    }

    const profile: LineProfile = await profileResponse.json();

    // Look up employee by LINE user ID
    const employee = await prisma.odg_employee.findFirst({
      where: { line_id: profile.userId },
    });

    // Store session with employee info
    const sessionData = {
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

    response.cookies.set(
      "session",
      Buffer.from(JSON.stringify(sessionData)).toString("base64"),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      }
    );

    return response;
  } catch (err) {
    console.error("LINE callback error:", err);
    return NextResponse.redirect(getPublicUrl(request, "/login?error=server_error"));
  }
}
