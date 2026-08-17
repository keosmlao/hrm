import "server-only";
import { prisma } from "./prisma";
import { ACTIVE_EMPLOYEE } from "./employee-status";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineIdentity = { sub: string; name?: string; picture?: string };

/**
 * ກວດ ID token ຂອງ LINE ຢູ່ຝັ່ງ server (ບໍ່ເຊື່ອ client).
 * ຕ້ອງ set LINE_CHANNEL_ID = channel ID ຂອງ LIFF/LINE Login channel.
 * ຄືນ null ຖ້າ token ບໍ່ຖືກຕ້ອງ / ໝົດອາຍຸ / config ຂາດ.
 */
export async function verifyLineIdToken(
  idToken: string,
): Promise<LineIdentity | null> {
  // ໂໝດທົດລອງ (dev ເທົ່ານັ້ນ): token ຮູບແບບ "dev:CODE" → ຂ້າມການ verify ຂອງ LINE
  if (process.env.NODE_ENV === "development" && idToken?.startsWith("dev:")) {
    return { sub: idToken, name: "DEV" };
  }
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId || !idToken) return null;

  try {
    const res = await fetch(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      sub?: string;
      name?: string;
      picture?: string;
    };
    if (!data.sub) return null;
    return { sub: data.sub, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}

/** ຫາພະນັກງານທີ່ຜູກ LINE userId (sub) ໄວ້ແລ້ວ */
export function employeeByLineId(sub: string) {
  // ໂໝດທົດລອງ (dev ເທົ່ານັ້ນ): sub = "dev:CODE" → ຫາຕາມລະຫັດພະນັກງານໂດຍກົງ
  if (process.env.NODE_ENV === "development" && sub.startsWith("dev:")) {
    return prisma.employee.findFirst({
      where: { code: sub.slice(4), ...ACTIVE_EMPLOYEE },
    });
  }
  return prisma.employee.findFirst({
    where: { lineId: sub, ...ACTIVE_EMPLOYEE },
  });
}
