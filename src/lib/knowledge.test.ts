import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageKb, canReadArticle, needsAck, parseTags, type KbViewer } from "./knowledge";

const employee: KbViewer = { role: "EMPLOYEE", employeeCode: "0100", departmentCode: "201", canManage: false };
const hr: KbViewer = { role: "HR", employeeCode: "0001", departmentCode: "801", canManage: true };

const article = (over: Partial<Parameters<typeof canReadArticle>[0]> = {}) => ({
  status: "PUBLISHED",
  visibility: "ALL",
  visibleDepartments: [] as string[],
  visibleRoles: [] as string[],
  authorCode: null as string | null,
  ...over,
});

test("ADMIN/HR ເປັນຜູ້ດູແລຄັງ, role ອື່ນບໍ່ແມ່ນ", () => {
  assert.equal(canManageKb("ADMIN"), true);
  assert.equal(canManageKb("HR"), true);
  assert.equal(canManageKb("MANAGER"), false);
  assert.equal(canManageKb("EXECUTIVE"), false);
  assert.equal(canManageKb("EMPLOYEE"), false);
});

test("ບົດທີ່ຍັງບໍ່ເຜີຍແຜ່ ພະນັກງານທົ່ວໄປເປີດບໍ່ໄດ້ ແຕ່ HR ໄດ້", () => {
  assert.equal(canReadArticle(article({ status: "DRAFT" }), employee), false);
  assert.equal(canReadArticle(article({ status: "PENDING" }), employee), false);
  assert.equal(canReadArticle(article({ status: "DRAFT" }), hr), true);
});

test("ຜູ້ຂຽນເຫັນຮ່າງຂອງຕົນເອງ", () => {
  assert.equal(canReadArticle(article({ status: "DRAFT", authorCode: "0100" }), employee), true);
  assert.equal(canReadArticle(article({ status: "DRAFT", authorCode: "0999" }), employee), false);
});

test("ຈຳກັດຕາມພະແນກ", () => {
  const a = article({ visibility: "DEPARTMENT", visibleDepartments: ["201", "202"] });
  assert.equal(canReadArticle(a, employee), true);
  assert.equal(canReadArticle(a, { ...employee, departmentCode: "301" }), false);
  // ບັນຊີທີ່ບໍ່ຜູກກັບພະນັກງານ (departmentCode = null) ຕ້ອງບໍ່ຫຼຸດຜ່ານ
  assert.equal(canReadArticle(a, { ...employee, departmentCode: null }), false);
});

test("ຫົວໜ້າທີ່ໄດ້ຮັບມອບສິດດູແລຄັງ ເຫັນຮ່າງໄດ້ຄືກັນ", () => {
  const granted: KbViewer = { role: "MANAGER", employeeCode: "0200", departmentCode: "301", canManage: true };
  assert.equal(canReadArticle(article({ status: "DRAFT" }), granted), true);
});

test("ຈຳກັດຕາມສິດ", () => {
  const a = article({ visibility: "ROLE", visibleRoles: ["MANAGER", "EXECUTIVE"] });
  assert.equal(canReadArticle(a, employee), false);
  assert.equal(canReadArticle(a, { ...employee, role: "MANAGER" }), true);
});

test("ເກັບເຂົ້າຄັງແລ້ວ ພະນັກງານທົ່ວໄປເປີດບໍ່ໄດ້", () => {
  assert.equal(canReadArticle(article({ status: "ARCHIVED" }), employee), false);
});

test("ແທັກ: ຕັດຊ່ອງ, ບໍ່ຊ້ຳ, ຮັບທັງຈຸດ ແລະ ຂຶ້ນແຖວ", () => {
  assert.deepEqual(parseTags(" ນະໂຍບາຍ , HR\nຄວາມປອດໄພ, HR "), ["ນະໂຍບາຍ", "HR", "ຄວາມປອດໄພ"]);
  assert.deepEqual(parseTags(""), []);
  assert.deepEqual(parseTags(null), []);
});

test("ແທັກ ຈຳກັດ 12 ອັນ", () => {
  const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join(",");
  assert.equal(parseTags(many).length, 12);
});

test("ຮັບຮູ້ຜູກກັບເລກຮຸ່ນ — ແກ້ບົດແລ້ວຕ້ອງຮັບຮູ້ໃໝ່", () => {
  const a = { requiresAck: true, status: "PUBLISHED", version: 2 };
  assert.equal(needsAck(a, []), true);
  assert.equal(needsAck(a, [1]), true, "ຮັບຮູ້ຮຸ່ນ 1 ແລ້ວ ແຕ່ບົດເປັນຮຸ່ນ 2");
  assert.equal(needsAck(a, [1, 2]), false);
});

test("ບົດທີ່ບໍ່ບັງຄັບ ຫຼື ຍັງບໍ່ເຜີຍແຜ່ ບໍ່ຕ້ອງຮັບຮູ້", () => {
  assert.equal(needsAck({ requiresAck: false, status: "PUBLISHED", version: 1 }, []), false);
  assert.equal(needsAck({ requiresAck: true, status: "DRAFT", version: 1 }, []), false);
});
