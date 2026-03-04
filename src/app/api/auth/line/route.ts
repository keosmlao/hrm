import { NextResponse } from "next/server";
import { createLineOAuthState } from "@/lib/line-oauth-state";
import { getPublicOrigin, isLocalHost } from "@/lib/public-url";

function getCallbackUrl(request: Request) {
  const publicOrigin = getPublicOrigin(request);
  const publicHostname = new URL(publicOrigin).hostname;

  if (process.env.NODE_ENV !== "production" && isLocalHost(publicHostname)) {
    return new URL("/api/auth/line/callback", publicOrigin).toString();
  }

  return process.env.LINE_CALLBACK_URL || new URL("/api/auth/line/callback", publicOrigin).toString();
}

export async function GET(request: Request) {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const callbackUrl = getCallbackUrl(request);

  if (!channelId || !channelSecret) {
    return NextResponse.json(
      { error: "LINE Login is not configured" },
      { status: 500 }
    );
  }

  const state = createLineOAuthState(channelSecret);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: callbackUrl,
    state,
    scope: "profile openid",
  });

  const authorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

  return NextResponse.redirect(authorizeUrl);
}
