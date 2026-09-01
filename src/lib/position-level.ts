/**
 * ລະດັບຕຳແໜ່ງ — ຕົວເລກນ້ອຍ = ລະດັບສູງກວ່າ
 * ຫ່າງເທື່ອລະ 10 ເພື່ອໃຫ້ແຊກລະດັບໃໝ່ລະຫວ່າງກາງໄດ້ ໂດຍບໍ່ຕ້ອງແກ້ຂໍ້ມູນເກົ່າ
 */
export const POSITION_LEVELS = [
  { value: 10, label: "ຜູ້ບໍລິຫານລະດັບສູງ" },
  { value: 20, label: "ຜູ້ອຳນວຍການ" },
  { value: 30, label: "ຫົວໜ້າພະແນກ" },
  { value: 40, label: "ຫົວໜ້າໜ່ວຍງານ" },
  { value: 50, label: "ພະນັກງານອາວຸໂສ" },
  { value: 60, label: "ພະນັກງານ" },
  { value: 70, label: "ຝຶກງານ / ທົດລອງງານ" },
] as const;

/** ຄ່າເລີ່ມຕົ້ນຂອງຕຳແໜ່ງທົ່ວໄປ ແລະ ຂອງຕຳແໜ່ງທີ່ໝາຍວ່າເປັນຫົວໜ້າ */
export const DEFAULT_POSITION_LEVEL = 60;
export const MANAGER_POSITION_LEVEL = 30;

export const POSITION_LEVEL_VALUES: number[] = POSITION_LEVELS.map((level) => level.value);

export function positionLevelLabel(level: number): string {
  return POSITION_LEVELS.find((item) => item.value === level)?.label ?? `ລະດັບ ${level}`;
}
