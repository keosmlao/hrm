import assert from "node:assert/strict";
import { test } from "node:test";
import { isEmployed, ACTIVE_EMPLOYEE } from "./employee-status";

test("ACTIVE ຖືວ່າຍັງເຮັດວຽກຢູ່", () => {
  assert.equal(isEmployed("ACTIVE"), true);
});

test("ລາອອກ / ຖືກໃຫ້ອອກ ຖືວ່າອອກແລ້ວ", () => {
  assert.equal(isEmployed("RESIGNED"), false);
  assert.equal(isEmployed("TERMINATED"), false);
});

test("ຄ່າຫວ່າງ/null ຖືວ່າບໍ່ຜ່ານ — ຂໍ້ມູນບໍ່ຄົບບໍ່ຄວນນັບເປັນພະນັກງານປັດຈຸບັນ", () => {
  assert.equal(isEmployed(null), false);
  assert.equal(isEmployed(undefined), false);
  assert.equal(isEmployed(""), false);
});

test("ເງື່ອນໄຂ Prisma ໃຊ້ employmentStatus ບໍ່ແມ່ນ hrStatus", () => {
  assert.deepEqual(ACTIVE_EMPLOYEE, { employmentStatus: "ACTIVE" });
});
