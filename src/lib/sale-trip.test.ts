import assert from "node:assert/strict";
import test from "node:test";
import { isSaleStockBalanced, saleOrderTotal, saleStockVariance } from "./sale-trip";

test("Sale Trip ຄິດຍອດຂາຍຫຼັງສ່ວນຫຼຸດ", () => {
  assert.equal(saleOrderTotal(3, 50_000, 10_000), 140_000);
  assert.equal(saleOrderTotal(1, 5_000, 10_000), 0);
});

test("Sale Trip ປິດ stock ໄດ້ເມື່ອ ຂາຍ+ແຈກ+ຄືນ+ເສຍ = ຂຶ້ນລົດ", () => {
  const stock = { loadedQty: 100, soldQty: 70, sampleQty: 5, returnedQty: 23, damagedQty: 2 };
  assert.equal(saleStockVariance(stock), 0);
  assert.equal(isSaleStockBalanced(stock), true);
  assert.equal(isSaleStockBalanced({ ...stock, returnedQty: 22 }), false);
});
