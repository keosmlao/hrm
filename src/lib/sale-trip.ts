export type SaleStockNumbers = {
  loadedQty: number;
  soldQty: number;
  sampleQty: number;
  returnedQty: number;
  damagedQty: number;
};

export function saleOrderTotal(quantity: number, unitPrice: number, discount = 0): number {
  return Math.max(0, Math.round(quantity * unitPrice) - Math.max(0, discount));
}

export function saleStockVariance(stock: SaleStockNumbers): number {
  return stock.loadedQty - stock.soldQty - stock.sampleQty - stock.returnedQty - stock.damagedQty;
}

export function isSaleStockBalanced(stock: SaleStockNumbers): boolean {
  return Math.abs(saleStockVariance(stock)) < 0.0001;
}
