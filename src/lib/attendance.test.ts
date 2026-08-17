import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceCycleRange,
  dateKey,
  distanceMeters,
  lateMinutesFor,
  workDateForShift,
  workedMinutesFor,
} from "./attendance";

function laoInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

test("ກະກາງເວັນ 8–5, 9–6 ແລະ 7–4 ຄິດການມາຊ້າຕາມ grace", () => {
  assert.equal(lateMinutesFor(laoInstant("2026-07-22", "08:15"), "08:00", 15, "17:00"), 0);
  assert.equal(lateMinutesFor(laoInstant("2026-07-22", "08:16"), "08:00", 15, "17:00"), 16);
  assert.equal(lateMinutesFor(laoInstant("2026-07-22", "09:20"), "09:00", 15, "18:00"), 20);
  assert.equal(lateMinutesFor(laoInstant("2026-07-22", "06:55"), "07:00", 15, "16:00"), 0);
});

test("ກະຂ້າມຄືນບໍ່ນັບການມາກ່ອນເປັນມາຊ້າ", () => {
  assert.equal(lateMinutesFor(laoInstant("2026-07-22", "21:00"), "22:00", 15, "06:00"), 0);
  assert.equal(lateMinutesFor(laoInstant("2026-07-22", "22:16"), "22:00", 15, "06:00"), 16);
  assert.equal(dateKey(workDateForShift(laoInstant("2026-07-23", "05:30"), "22:00", "06:00")), "2026-07-22");
});

test("ຮອບເດືອນ 07 ແມ່ນ 26/06–25/07", () => {
  const range = attendanceCycleRange("2026-07", 25);
  assert.equal(dateKey(range.start), "2026-06-26");
  assert.equal(dateKey(range.end), "2026-07-25");
});

test("ຄິດນາທີເຮັດວຽກ ແລະໄລຍະ GPS", () => {
  assert.equal(workedMinutesFor(laoInstant("2026-07-22", "08:00"), laoInstant("2026-07-22", "17:00")), 540);
  assert.equal(distanceMeters(17.9757, 102.6331, 17.9757, 102.6331), 0);
  assert.ok(distanceMeters(17.9757, 102.6331, 17.9767, 102.6331) > 100);
});
