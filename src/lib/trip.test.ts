import assert from "node:assert/strict";
import test from "node:test";
import { isValidTripTimeRange, tripDayCount } from "./trip";

test("Trip ມື້ດຽວນັບເປັນ 1 ມື້", () => {
  assert.equal(tripDayCount(new Date("2026-07-22T00:00:00Z"), new Date("2026-07-22T00:00:00Z")), 1);
});

test("Trip 22–24 ນັບລວມເປັນ 3 ມື້", () => {
  assert.equal(tripDayCount(new Date("2026-07-22T00:00:00Z"), new Date("2026-07-24T00:00:00Z")), 3);
});

test("Trip ມື້ດຽວຕ້ອງສິ້ນສຸດຫຼັງເວລາເລີ່ມ", () => {
  const date = new Date("2026-07-22T00:00:00Z");
  assert.equal(isValidTripTimeRange(date, date, "08:00", "17:00"), true);
  assert.equal(isValidTripTimeRange(date, date, "17:00", "08:00"), false);
});

test("Trip ຫຼາຍມື້ຮອງຮັບເວລາສິ້ນສຸດໃນວັນສຸດທ້າຍ", () => {
  assert.equal(isValidTripTimeRange(new Date("2026-07-22T00:00:00Z"), new Date("2026-07-24T00:00:00Z"), "17:00", "08:00"), true);
});
