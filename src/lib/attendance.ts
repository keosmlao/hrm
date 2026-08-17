/**
 * ຕົວຊ່ວຍຄິດໄລ່ການລົງເວລາ — ໃຊ້ໄດ້ທັງ route handler ແລະ server component
 *
 * ⏰ ເຂດເວລາ: ລາວ = UTC+7 ຄົງທີ່ (ບໍ່ມີ daylight saving) → ໃຊ້ offset ຄົງທີ່ໄດ້ຢ່າງປອດໄພ
 * ⚙️  ຄ່າ default ມາຈາກ .env; ໜ້າ Settings ສາມາດ override ໃນ DB.
 */

export const LAO_OFFSET_MIN = 7 * 60;

export const WORK_START = process.env.WORK_START ?? "08:00";
export const WORK_END = process.env.WORK_END ?? "17:00";
export const LATE_GRACE_MIN = Number(process.env.LATE_GRACE_MIN ?? "15");

/** "HH:MM" → ນາທີນັບແຕ່ທ່ຽງຄືນ */
export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** ນາທີໃນມື້ (ຕາມເວລາລາວ) ຂອງ instant ໃດໜຶ່ງ */
export function laoMinutesOfDay(instant: Date): number {
  const t = new Date(instant.getTime() + LAO_OFFSET_MIN * 60000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** ແຍກ instant ອອກເປັນເວລາໜ້າປັດ (wall-clock) ຂອງລາວ */
function laoParts(instant: Date) {
  const t = new Date(instant.getTime() + LAO_OFFSET_MIN * 60000);
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth(),
    d: t.getUTCDate(),
    minutesOfDay: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

/** ວັນທີວຽກ (ຕາມປະຕິທິນລາວ) ເປັນ Date ທ່ຽງຄືນ UTC — ເໝາະສຳລັບ column ຊະນິດ @db.Date */
export function laoWorkDate(instant: Date): Date {
  const { y, mo, d } = laoParts(instant);
  return new Date(Date.UTC(y, mo, d));
}

/**
 * ວັນທີຂອງກະ. ກະຂ້າມຄືນ (ເຊັ່ນ 22:00–06:00) ຈະບັນທຶກ
 * check-out ຕອນເຊົ້າເຂົ້າໃນວັນທີ່ເລີ່ມກະ.
 */
export function workDateForShift(instant: Date, startTime: string, endTime: string): Date {
  const date = laoWorkDate(instant);
  const start = parseHHMM(startTime);
  const end = parseHHMM(endTime);
  if (end > start) return date;

  const { minutesOfDay } = laoParts(instant);
  const rollover = end + Math.floor((start - end) / 2);
  if (minutesOfDay < rollover) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

/** ກະແຈວັນທີ "YYYY-MM-DD" (ຕາມ Lao ຫຼືຈາກ Date ທ່ຽງຄືນ UTC) */
export function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * ຄິດໄລ່ນາທີມາຊ້າ:
 *   - ມາກ່ອນ ຫຼືພາຍໃນ grace (ເລີ່ມ + LATE_GRACE_MIN) → 0 (ບໍ່ຖືວ່າຊ້າ)
 *   - ຊ້າກວ່ານັ້ນ → ນັບຈາກເວລາເລີ່ມງານຈິງ
 */
export function lateMinutesFor(
  checkIn: Date,
  workStart = WORK_START,
  lateGraceMinutes = LATE_GRACE_MIN,
  workEnd = WORK_END,
): number {
  const workDate = workDateForShift(checkIn, workStart, workEnd);
  const start = parseHHMM(workStart);
  const scheduledStartUtc = Date.UTC(
    workDate.getUTCFullYear(),
    workDate.getUTCMonth(),
    workDate.getUTCDate(),
    Math.floor(start / 60) - 7,
    start % 60,
  );
  const minutesLate = Math.max(0, Math.floor((checkIn.getTime() - scheduledStartUtc) / 60000));
  return minutesLate <= lateGraceMinutes ? 0 : minutesLate;
}

/** ນາທີເຮັດວຽກ (ຫ່າງລະຫວ່າງເຂົ້າ-ອອກ ດິບ ບໍ່ຫັກພັກທ່ຽງ) */
export function workedMinutesFor(checkIn: Date, checkOut: Date): number {
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000));
}

/** ໄລຍະທາງເສັ້ນຊື່ລະຫວ່າງສອງພິກັດ GPS (Haversine), ໜ່ວຍແມັດ. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** ວັນທຳການ (ຈັນ–ສຸກ) ພາຍໃນຊ່ວງ [start, end] — ນັບຈາກ Date ທ່ຽງຄືນ UTC */
export function eachWorkingDay(
  start: Date,
  end: Date,
  excludedDates: ReadonlySet<string> = new Set(),
): Date[] {
  return eachScheduledWorkingDay(start, end, false, excludedDates);
}

/** ວັນເຮັດວຽກຕາມຮູບແບບກະ: ກະວຽນສາມາດເຮັດວຽກເສົາ–ອາທິດ. */
export function eachScheduledWorkingDay(
  start: Date,
  end: Date,
  includeWeekends: boolean,
  excludedDates: ReadonlySet<string> = new Set(),
  allowedWeekdays?: ReadonlySet<number>,
): Date[] {
  const days: Date[] = [];
  const cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    const dow = cur.getUTCDay(); // 0=ອາທິດ, 6=ເສົາ
    const isScheduled = allowedWeekdays
      ? allowedWeekdays.has(dow)
      : includeWeekends || (dow !== 0 && dow !== 6);
    if (isScheduled && !excludedDates.has(dateKey(cur))) {
      days.push(new Date(cur.getTime()));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** ຂອບເຂດເດືອນ (ຕາມ "YYYY-MM") ເປັນ Date ທ່ຽງຄືນ UTC */
export function monthRange(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 0)), // ວັນສຸດທ້າຍຂອງເດືອນ
  };
}

/**
 * ຮອບສະຫຼຸບການລົງເວລາ: ມື້ຖັດຈາກວັນປິດຮອບຂອງເດືອນກ່ອນ
 * ຫາວັນປິດຮອບຂອງເດືອນທີ່ເລືອກ.
 * ຕົວຢ່າງ 2026-07 = 2026-06-26 ... 2026-07-25.
 */
export function attendanceCycleRange(
  monthKey: string,
  endDay = 25,
): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 2, endDay + 1)),
    end: new Date(Date.UTC(year, month - 1, endDay)),
  };
}

/** ເດືອນປັດຈຸບັນຕາມລາວ "YYYY-MM" */
export function currentLaoMonth(now: Date = new Date()): string {
  const { y, mo } = laoParts(now);
  return `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/** ຕັ້ງແຕ່ວັນທີ 26 ເປັນຕົ້ນໄປ ຖືເປັນຮອບຂອງເດືອນຖັດໄປ. */
export function currentAttendanceCycleMonth(now: Date = new Date(), endDay = 25): string {
  const date = laoWorkDate(now);
  if (date.getUTCDate() > endDay) date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** ຊົ່ວໂມງ:ນາທີ ອ່ານງ່າຍ ຈາກຈຳນວນນາທີ */
export function fmtMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}ຊມ ${m}ນທ` : `${m}ນທ`;
}
