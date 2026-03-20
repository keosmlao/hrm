type LinePushResult =
  | { sent: true }
  | { sent: false; reason: "missing_user_id" | "not_configured" | "api_error" };

function getLineMessagingAccessToken() {
  const candidates = [
    process.env.LINE_MESSAGING_API_TOKEN,
    process.env.LINE_CHANNEL_ACCESS_TOKEN,
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function formatSchedule(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function sendMeetingNotification({
  userId,
  title,
  meetingDate,
  startTime,
  endTime,
  location,
  organizerName,
  detailUrl,
}: {
  userId: string;
  title: string;
  meetingDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  organizerName: string | null;
  detailUrl: string | null;
}): Promise<LinePushResult> {
  if (!userId?.trim()) {
    return { sent: false, reason: "missing_user_id" };
  }

  const accessToken = getLineMessagingAccessToken();
  if (!accessToken) {
    return { sent: false, reason: "not_configured" };
  }

  const datePart = meetingDate ? formatSchedule(meetingDate) || meetingDate : null;
  const timePart = startTime ? (endTime ? `${startTime} - ${endTime}` : startTime) : null;

  const lines = [
    "ທ່ານຖືກເຊີນເຂົ້າຮ່ວມປະຊຸມ",
    `ຫົວຂໍ້: ${title}`,
    datePart ? `ວັນທີ: ${datePart}` : null,
    timePart ? `ເວລາ: ${timePart}` : null,
    location ? `ສະຖານທີ່: ${location}` : null,
    organizerName ? `ນັດໂດຍ: ${organizerName}` : null,
    detailUrl ? `ເບິ່ງລາຍລະອຽດ: ${detailUrl}` : null,
  ].filter(Boolean);

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: lines.join("\n") }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send meeting LINE notification:", response.status, body);
      return { sent: false, reason: "api_error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("Meeting LINE push failed:", error);
    return { sent: false, reason: "api_error" };
  }
}

export async function sendCrsRegistrationLineNotification({
  userId,
  title,
  location,
  scheduledAt,
  detailUrl,
}: {
  userId: string | null | undefined;
  title: string;
  location: string | null;
  scheduledAt: string | null;
  detailUrl: string | null;
}): Promise<LinePushResult> {
  if (!userId?.trim()) {
    return { sent: false, reason: "missing_user_id" };
  }

  const accessToken = getLineMessagingAccessToken();
  if (!accessToken) {
    return { sent: false, reason: "not_configured" };
  }

  const lines = [
    "ລົງທະບຽນ CRS ສຳເລັດແລ້ວ",
    `ຫົວຂໍ້: ${title}`,
    scheduledAt ? `ກຳນົດການ: ${formatSchedule(scheduledAt) || scheduledAt}` : null,
    location ? `ສະຖານທີ່: ${location}` : null,
    detailUrl ? `ເຂົ້າເບິ່ງ: ${detailUrl}` : null,
    "ເຂົ້າ HRM ເພື່ອກວດລາຍລະອຽດໄດ້ທຸກເວລາ",
  ].filter(Boolean);

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send LINE push message:", response.status, body);
      return { sent: false, reason: "api_error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("LINE push request failed:", error);
    return { sent: false, reason: "api_error" };
  }
}
