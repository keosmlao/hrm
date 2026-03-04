const DEFAULT_APP_ORIGIN = "https://hrm.odienmall.com";

export function getConfiguredAppOrigin() {
  const candidates = [
    process.env.APP_BASE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.LINE_CALLBACK_URL,
    DEFAULT_APP_ORIGIN,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate).origin;
    } catch {
      // Ignore invalid values and continue to the next candidate.
    }
  }

  return DEFAULT_APP_ORIGIN;
}
