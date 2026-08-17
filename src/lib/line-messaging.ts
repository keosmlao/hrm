import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export function verifyLineWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function attendanceLiffUrl(): string | null {
  const configured = process.env.LINE_ATTENDANCE_LIFF_URL?.trim();
  if (configured) return configured;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return liffId ? `https://liff.line.me/${liffId}` : null;
}

export async function replyWithAttendanceButton(replyToken: string): Promise<boolean> {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const uri = attendanceLiffUrl();
  if (!accessToken || !uri) return false;

  const response = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "template",
          altText: "ເປີດລະບົບລົງເວລາ ODIEN GROUP",
          template: {
            type: "buttons",
            text: "ກົດປຸ່ມດ້ານລຸ່ມເພື່ອລົງເວລາເຂົ້າ–ອອກວຽກ",
            actions: [
              {
                type: "uri",
                label: "ລົງເວລາເຮັດວຽກ",
                uri,
              },
            ],
          },
        },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("LINE reply failed", response.status, await response.text());
  }
  return response.ok;
}
