/**
 * ອອກລະຫັດຊັບສິນຕໍ່ຈາກຂອງເກົ່າ — ຮູບແບບ SML: `{ປະເພດ}-{ເລກ 8 ຫຼັກ}`
 * ຕົວຢ່າງ `200-00000379`
 *
 * ວັດແທກຈາກຂໍ້ມູນຈິງ 623 ລາຍການ: 621 ອັນເປັນ 8 ຫຼັກ (ອີກ 2 ອັນເປັນຂໍ້ມູນຜິດເກົ່າ
 * `400-00000`, `400-000001`) ຈຶ່ງຖື 8 ຫຼັກເປັນມາດຕະຖານ.
 *
 * ບໍ່ import prisma ຈຶ່ງ test ໄດ້.
 */

export const SEQ_WIDTH = 8;

/** ດຶງເລກລຳດັບອອກຈາກລະຫັດ — ຄືນ null ຖ້າຮູບແບບບໍ່ກົງ */
export function parseAssetSeq(code: string, prefix: string): number | null {
  const m = new RegExp(`^${prefix}-(\\d+)$`).exec(code.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * ລະຫັດຕໍ່ໄປຂອງຄຳນຳໜ້ານີ້.
 *
 * ໃຊ້ **ເລກສູງສຸດ + 1** ບໍ່ແມ່ນອຸດຊ່ອງຫວ່າງ — ຂໍ້ມູນຈິງມີຊ່ອງຫວ່າງ 23 ເລກ
 * ເຊິ່ງເກີດຈາກການລຶບ/ຍົກເລີກ ການເອົາເລກເກົ່າມາໃຊ້ຄືນຈະສັບສົນກັບເອກະສານເດີມ.
 */
export function nextAssetCode(prefix: string, existingCodes: string[]): string {
  const max = existingCodes.reduce((m, c) => {
    const n = parseAssetSeq(c, prefix);
    return n != null && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(SEQ_WIDTH, "0")}`;
}
