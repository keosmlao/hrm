const DAY_MS = 24 * 60 * 60 * 1000;

export function tripDayCount(startDate: Date, endDate: Date) {
  return Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
}

export function tripDateRangeLabel(startDate: Date, endDate: Date, format: (date: Date) => string) {
  return startDate.getTime() === endDate.getTime()
    ? format(startDate)
    : `${format(startDate)} – ${format(endDate)} (${tripDayCount(startDate, endDate)} ມື້)`;
}

export function isValidTripTimeRange(startDate: Date, endDate: Date, startTime: string, endTime: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return false;
  return endDate.getTime() > startDate.getTime() || endTime > startTime;
}

export function tripScheduleLabel(startDate: Date, endDate: Date, startTime: string | null, endTime: string | null, format: (date: Date) => string) {
  if (!startTime || !endTime) return tripDateRangeLabel(startDate, endDate, format);
  if (startDate.getTime() === endDate.getTime()) return `${format(startDate)} · ${startTime}–${endTime}`;
  return `${format(startDate)} ${startTime} → ${format(endDate)} ${endTime} (${tripDayCount(startDate, endDate)} ມື້)`;
}
