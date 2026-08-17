import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAssetCode, parseAssetSeq } from "./asset-code";

test("ອອກເລກຕໍ່ຈາກເລກສູງສຸດ ພ້ອມເຕີມສູນ 8 ຫຼັກ", () => {
  assert.equal(nextAssetCode("200", ["200-00000375", "200-00000378", "200-00000101"]), "200-00000379");
});

test("ນັບແຍກຕາມຄຳນຳໜ້າ — ບໍ່ປົນປະເພດອື່ນ", () => {
  assert.equal(nextAssetCode("400", ["200-00000378", "400-00000267"]), "400-00000268");
});

test("ຍັງບໍ່ມີລາຍການໃດ ເລີ່ມທີ່ 1", () => {
  assert.equal(nextAssetCode("500", []), "500-00000001");
});

test("ບໍ່ອຸດຊ່ອງຫວ່າງ — ເອົາເລກສູງສຸດ+1 ສະເໝີ", () => {
  // ຂາດ 2,3,4 ແຕ່ຍັງຕໍ່ຈາກ 5
  assert.equal(nextAssetCode("400", ["400-00000001", "400-00000005"]), "400-00000006");
});

test("ຂ້າມລະຫັດຮູບແບບເກົ່າທີ່ຫຼັກບໍ່ຄົບໄດ້ (ຍັງອ່ານເລກໄດ້)", () => {
  assert.equal(parseAssetSeq("400-000001", "400"), 1);
  assert.equal(parseAssetSeq("400-abc", "400"), null);
  assert.equal(parseAssetSeq("200-00000378", "400"), null);
});
