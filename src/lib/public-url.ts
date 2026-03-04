import { getConfiguredAppOrigin } from "@/lib/app-origin";

export function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getPublicOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = getConfiguredAppOrigin();
  const forwardedHost = normalizeHeaderValue(
    request.headers.get("x-forwarded-host") || request.headers.get("host")
  );
  const forwardedProto = normalizeHeaderValue(request.headers.get("x-forwarded-proto"));

  if (forwardedHost) {
    const forwardedHostname = forwardedHost.split(":")[0];

    if (process.env.NODE_ENV === "production" && !isLocalHost(forwardedHostname)) {
      return configuredOrigin || `https://${forwardedHost}`;
    }

    const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
    return `${protocol}://${forwardedHost}`;
  }

  if (process.env.NODE_ENV === "production") {
    if (!isLocalHost(requestUrl.hostname)) {
      return configuredOrigin || `https://${requestUrl.host}`;
    }
  }

  return requestUrl.origin;
}

export function getPublicUrl(request: Request, path: string) {
  return new URL(path, getPublicOrigin(request));
}
