import { NextResponse } from "next/server";
import { createLineOAuthState } from "@/lib/line-oauth-state";
import { getPublicOrigin, isLocalHost } from "@/lib/public-url";

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

function getCallbackUrl(request: Request) {
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

export async function GET(request: Request) {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const missing = [
    !isConfiguredValue(channelId) ? "LINE_CHANNEL_ID" : null,
    !isConfiguredValue(channelSecret) ? "LINE_CHANNEL_SECRET" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "LINE Login is not configured", missing },
      { status: 500 }
    );
  }

  const callbackUrl = getCallbackUrl(request);
  const state = createLineOAuthState(channelSecret!);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId!,
    redirect_uri: callbackUrl,
    state,
    scope: "profile openid",
  });

  return NextResponse.redirect(
    `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
  );
}
