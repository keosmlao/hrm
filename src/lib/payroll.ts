/**
 * ຄິດໄລ່ເງິນເດືອນ — ປະກັນສັງຄົມ (LSSO) ແລະ ພາສີລາຍໄດ້ບຸກຄົນ (PIT) ຂອງ ສປປ ລາວ
 * ⚙️ ອັດຕາ/ຂັ້ນ ຕັ້ງຜ່ານ .env ໄດ້ (ຖ້າກົດໝາຍປ່ຽນ ບໍ່ຕ້ອງ deploy code)
 */

export const SSO_RATE = Number(process.env.SSO_RATE ?? "0.055"); // ສ່ວນພະນັກງານ 5.5%
export const SSO_CEILING = Number(process.env.SSO_CEILING ?? "4500000"); // ເພດານຄິດໄລ່
export const WORK_DAYS_PER_MONTH = Number(process.env.WORK_DAYS_PER_MONTH ?? "26");

/** ຂັ້ນພາສີລາຍໄດ້ບຸກຄົນ ຕໍ່ເດືອນ (LAK) */
const PIT_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 1_300_000, rate: 0 },
  { upTo: 5_000_000, rate: 0.05 },
  { upTo: 15_000_000, rate: 0.1 },
  { upTo: 25_000_000, rate: 0.15 },
  { upTo: 65_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.25 },
];

export function socialSecurity(monthlySalary: number): number {
  return Math.round(Math.min(monthlySalary, SSO_CEILING) * SSO_RATE);
}

export function incomeTax(taxable: number): number {
  let tax = 0;
  let prev = 0;
  for (const b of PIT_BRACKETS) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return Math.round(tax);
}

export function dailyRate(baseSalary: number): number {
  return baseSalary / WORK_DAYS_PER_MONTH;
}

export function hourlyRate(baseSalary: number): number {
  return baseSalary / (WORK_DAYS_PER_MONTH * 8);
}

export type PayInputs = {
  baseSalary: number;
  positionAllowance: number;
  commission?: number;
  otAmount?: number;
  bonus?: number;
  otherEarnings?: number;
  lateDeduction?: number;
  absentDeduction?: number;
  otherDeductions?: number;
};

export type PayResult = {
  grossPay: number;
  socialSecurity: number;
  incomeTax: number;
  totalDeduction: number;
  netPay: number;
};

/** ຄິດ gross / ຫັກ / net ຈາກ input (ປະກັນສັງຄົມຄິດຈາກເງິນເດືອນພື້ນຖານ, ພາສີຈາກລາຍໄດ້ຫຼັງຫັກປະກັນ) */
export function computePay(i: PayInputs): PayResult {
  const gross =
    i.baseSalary +
    i.positionAllowance +
    (i.commission ?? 0) +
    (i.otAmount ?? 0) +
    (i.bonus ?? 0) +
    (i.otherEarnings ?? 0);

  const ss = socialSecurity(i.baseSalary);
  const tax = incomeTax(gross - ss);
  const totalDeduction =
    ss +
    tax +
    (i.lateDeduction ?? 0) +
    (i.absentDeduction ?? 0) +
    (i.otherDeductions ?? 0);

  return {
    grossPay: Math.round(gross),
    socialSecurity: ss,
    incomeTax: tax,
    totalDeduction: Math.round(totalDeduction),
    netPay: Math.round(gross - totalDeduction),
  };
}
