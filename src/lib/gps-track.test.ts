import assert from "node:assert/strict";
import { test } from "node:test";
import { detectStops, fuelNorm, minutesLabel, num, resolveRange } from "./gps-track";

/** ຈຸດຈຳລອງ — ເລີ່ມທີ່ເວລາ base ແລ້ວບວກນາທີ */
const BASE = Date.parse("2026-08-13T01:00:00.000Z");
function p(minute: number, lat: number, lng: number, speed: number) {
  return {
    time: new Date(BASE + minute * 60000).toISOString(),
    latitude: lat,
    longitude: lng,
    speed_kmh: speed,
    address: null,
  };
}

test("ຈອດຄົບເກນເວລາ ຖືວ່າເປັນຈຸດຈອດ", () => {
  const stops = detectStops(
    [p(0, 18.0, 102.6, 0), p(5, 18.0, 102.6, 0), p(10, 18.0, 102.6, 0)],
    { minMinutes: 5 },
  );
  assert.equal(stops.length, 1);
  assert.equal(stops[0].minutes, 10);
  assert.equal(stops[0].seq, 1);
});

test("ຈອດສັ້ນກວ່າເກນ ບໍ່ນັບເປັນຈຸດຈອດ", () => {
  const stops = detectStops([p(0, 18.0, 102.6, 0), p(3, 18.0, 102.6, 0)], { minMinutes: 5 });
  assert.equal(stops.length, 0);
});

test("GPS ແກວ່ງເລັກນ້ອຍຕອນຈອດ ຍັງນັບເປັນຈຸດຈອດດຽວ", () => {
  // ຫ່າງກັນ ~20 ແມັດ — ຢູ່ໃນລັດສະໝີ default (80 ມ)
  const stops = detectStops(
    [p(0, 18.0, 102.6, 0), p(5, 18.00018, 102.60002, 1), p(10, 17.99985, 102.6, 0)],
    { minMinutes: 5 },
  );
  assert.equal(stops.length, 1, "ຄວນລວມເປັນຈຸດຈອດດຽວ ບໍ່ແມ່ນແຍກເປັນຫຼາຍຈຸດ");
  assert.equal(stops[0].minutes, 10);
});

test("ຍ້າຍໄກເກີນລັດສະໝີ ຖືວ່າເປັນຄົນລະຈຸດ", () => {
  const stops = detectStops(
    [
      p(0, 18.0, 102.6, 0),
      p(10, 18.0, 102.6, 0),
      p(11, 18.05, 102.65, 40), // ແລ່ນອອກ
      p(20, 18.1, 102.7, 0),
      p(30, 18.1, 102.7, 0),
    ],
    { minMinutes: 5 },
  );
  assert.equal(stops.length, 2);
  assert.equal(stops[1].seq, 2);
});

test("ຄວາມໄວສູງ ບໍ່ນັບເປັນຈອດ ເຖິງວ່າຈະຢູ່ບ່ອນເກົ່າ", () => {
  const stops = detectStops(
    [p(0, 18.0, 102.6, 30), p(5, 18.0, 102.6, 30), p(10, 18.0, 102.6, 30)],
    { minMinutes: 5 },
  );
  assert.equal(stops.length, 0);
});

test("ຈຸດທີ່ບໍ່ມີພິກັດ ຖືກຄັດອອກ", () => {
  const bad = { time: new Date(BASE).toISOString(), latitude: null, longitude: null, speed_kmh: 0, address: null };
  const stops = detectStops([bad, p(0, 18.0, 102.6, 0), p(8, 18.0, 102.6, 0)], { minMinutes: 5 });
  assert.equal(stops.length, 1);
});

test("ຊ່ວງວັນທີກັບຫົວກັບຫາງ ຖືກສະຫຼັບໃຫ້", () => {
  const r = resolveRange("2026-08-20", "2026-08-10", 31);
  assert.equal(r.from, "2026-08-10");
  assert.equal(r.to, "2026-08-20");
  assert.ok(r.note, "ຄວນແຈ້ງວ່າສະຫຼັບໃຫ້ແລ້ວ");
});

test("ຊ່ວງກວ້າງເກີນ ຖືກບີບ ແລະ ແຈ້ງເຕືອນ", () => {
  const r = resolveRange("2026-08-01", "2026-08-31", 7);
  assert.equal(r.to, "2026-08-31");
  assert.equal(r.from, "2026-08-25", "7 ວັນນັບຮວມວັນສຸດທ້າຍ");
  assert.ok(r.note);
});

test("ຊ່ວງທີ່ຖືກຕ້ອງ ບໍ່ຖືກແຕະ ແລະ ບໍ່ມີຄຳເຕືອນ", () => {
  const r = resolveRange("2026-08-10", "2026-08-12", 31);
  assert.deepEqual([r.from, r.to, r.note], ["2026-08-10", "2026-08-12", null]);
});

test("num ບໍ່ປ່ຽນ null ເປັນ 0", () => {
  assert.equal(num(null), "—");
  assert.equal(num(0), "0");
  assert.equal(num(1234.56, 1), "1,234.6");
});

test("minutesLabel ແປງເປັນ ຊມ/ນທ", () => {
  assert.equal(minutesLabel(45), "45 ນທ");
  assert.equal(minutesLabel(135), "2 ຊມ 15 ນທ");
});

test("fuelNorm ຄິດຄ່າລວມ ແລະ ມັດທະຍົມ", () => {
  const n = fuelNorm([
    { day: "2026-08-01", km: 100, litre: 10 }, // 10 ກມ/ລ
    { day: "2026-08-02", km: 200, litre: 10 }, // 20
    { day: "2026-08-03", km: 150, litre: 10 }, // 15
  ]);
  assert.equal(n.days, 3);
  assert.equal(n.totalKm, 450);
  assert.equal(n.kmPerLitre, 15, "450 ກມ ÷ 30 ລ");
  assert.equal(n.median, 15);
});

test("fuelNorm ຄັດວັນທີ່ແລ່ນໜ້ອຍ ແລະ ວັນທີ່ບໍ່ມີຄ່ານ້ຳມັນອອກ", () => {
  const n = fuelNorm([
    { day: "a", km: 2, litre: 1 }, // ສັ້ນເກີນ (< 5 ກມ)
    { day: "b", km: 100, litre: 0 }, // ບໍ່ມີຄ່ານ້ຳມັນ
    { day: "c", km: 100, litre: 10 },
  ]);
  assert.equal(n.days, 1);
  assert.equal(n.kmPerLitre, 10);
});

test("fuelNorm ບໍ່ມີຂໍ້ມູນ ຄືນ null ບໍ່ແມ່ນ 0", () => {
  const n = fuelNorm([]);
  assert.equal(n.days, 0);
  assert.equal(n.kmPerLitre, null);
  assert.equal(n.median, null);
});

test("fuelNorm ຄ່າລວມຕ່າງຈາກມັດທະຍົມ ເມື່ອມີວັນຜິດປົກກະຕິ", () => {
  const n = fuelNorm([
    { day: "a", km: 100, litre: 10 },
    { day: "b", km: 100, litre: 10 },
    { day: "c", km: 100, litre: 100 }, // ວັນທີ່ເຕີມນ້ຳມັນ/ຜິດປົກກະຕິ
  ]);
  assert.equal(n.median, 10, "ມັດທະຍົມບໍ່ຖືກວັນຜິດປົກກະຕິດຶງ");
  assert.ok(n.kmPerLitre! < 3, "ຄ່າລວມຖືກດຶງລົງ");
});
