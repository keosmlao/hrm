import { NextResponse, type NextRequest } from "next/server";
import {
  replyWithAttendanceButton,
  verifyLineWebhookSignature,
} from "@/lib/line-messaging";

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
  postback?: { data?: string };
};

const ATTENDANCE_KEYWORDS = [
  "ລົງເວລາ",
  "ເຂົ້າວຽກ",
  "ອອກວຽກ",
  "ເມນູ",
  "ลงเวลา",
  "เข้างาน",
  "ออกงาน",
  "clock",
  "attendance",
];

function needsAttendanceReply(event: LineWebhookEvent): boolean {
  if (event.type === "follow") return true;
  if (event.type === "postback") return event.postback?.data === "action=attendance";
  if (event.type !== "message" || event.message?.type !== "text") return false;
  const text = event.message.text?.trim().toLowerCase() ?? "";
  return ATTENDANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

/** Webhook ຂອງ LINE Official Account (Messaging API). */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  if (!verifyLineWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: { events?: LineWebhookEvent[] };
  try {
    body = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const events = body.events ?? [];
  await Promise.all(
    events.map(async (event) => {
      if (!event.replyToken || !needsAttendanceReply(event)) return;
      await replyWithAttendanceButton(event.replyToken);
    }),
  );
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
