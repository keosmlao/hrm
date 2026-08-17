import assert from "node:assert/strict";
import test from "node:test";
import { extrapolateGpsPosition } from "./gps-motion";

test("ລົດ 36 ກມ/ຊມ ໄປທິດເໜືອ 15 ວິນາທີ ເຄື່ອນປະມານ 150 ແມັດ", () => {
  const p = extrapolateGpsPosition({
    lat: 18,
    lng: 102.6,
    speedKmh: 36,
    headingDegrees: 0,
    elapsedSeconds: 15,
  });

  assert.ok(p.lat > 18);
  assert.ok(Math.abs(p.lat - 18.001349) < 0.00001);
  assert.ok(Math.abs(p.lng - 102.6) < 0.00001);
});

test("90° ເຄື່ອນໄປທິດຕາເວັນອອກ", () => {
  const p = extrapolateGpsPosition({
    lat: 18,
    lng: 102.6,
    speedKmh: 36,
    headingDegrees: 90,
    elapsedSeconds: 15,
  });

  assert.ok(Math.abs(p.lat - 18) < 0.00001);
  assert.ok(p.lng > 102.6);
});

test("ຄວາມໄວ 72 ກມ/ຊມ ເຄື່ອນໄກເປັນ 2 ເທົ່າຂອງ 36 ກມ/ຊມ", () => {
  const slow = extrapolateGpsPosition({
    lat: 18,
    lng: 102.6,
    speedKmh: 36,
    headingDegrees: 0,
    elapsedSeconds: 10,
  });
  const fast = extrapolateGpsPosition({
    lat: 18,
    lng: 102.6,
    speedKmh: 72,
    headingDegrees: 0,
    elapsedSeconds: 10,
  });

  const slowDelta = slow.lat - 18;
  const fastDelta = fast.lat - 18;
  assert.ok(Math.abs(fastDelta / slowDelta - 2) < 0.001);
});

test("ລົດຈອດບໍ່ປ່ຽນພິກັດ", () => {
  assert.deepEqual(
    extrapolateGpsPosition({
      lat: 18,
      lng: 102.6,
      speedKmh: 0,
      headingDegrees: 180,
      elapsedSeconds: 15,
    }),
    { lat: 18, lng: 102.6 },
  );
});
