import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_POSITION_LEVEL } from "@/lib/position-level";

export type PositionWithSetting = {
  code: string;
  nameLo: string;
  nameEn: string | null;
  isManager: boolean;
  isActive: boolean;
  level: number;
  sortOrder: number;
};

/**
 * ອ່ານລະດັບ/ລຳດັບຂອງແຕ່ລະຕຳແໜ່ງ
 * ຖ້າຍັງບໍ່ໄດ້ deploy migration (P2021 = ບໍ່ມີຕາຕະລາງ) ໃຫ້ຖືວ່າຍັງບໍ່ມີການຕັ້ງຄ່າ ແທນທີ່ຈະລົ້ມ
 */
export async function getPositionSettings(): Promise<
  Map<string, { level: number; sortOrder: number }>
> {
  const rows = await prisma.positionSetting
    .findMany({ select: { positionCode: true, level: true, sortOrder: true } })
    .catch((e: { code?: string }) => {
      if (e?.code === "P2021") return [];
      throw e;
    });
  return new Map(rows.map((row) => [row.positionCode, { level: row.level, sortOrder: row.sortOrder }]));
}

/** ຮຽງຕາມ ລະດັບ → ລຳດັບແສດງ → ລະຫັດ (ລະຫັດເປັນຕົວເລກ ຈຶ່ງທຽບແບບຕົວເລກ) */
export function comparePositions(a: PositionWithSetting, b: PositionWithSetting): number {
  return (
    a.level - b.level ||
    a.sortOrder - b.sortOrder ||
    a.code.localeCompare(b.code, "en", { numeric: true })
  );
}

/** ລາຍຊື່ຕຳແໜ່ງພ້ອມການຕັ້ງຄ່າ ຮຽງລຳດັບພ້ອມໃຊ້ໃນ dropdown ແລະ ຕາຕະລາງ */
export async function listPositions(
  options: { activeOnly?: boolean } = {},
): Promise<PositionWithSetting[]> {
  const [positions, settings] = await Promise.all([
    prisma.position.findMany({
      where: options.activeOnly ? { NOT: { isActive: false } } : undefined,
    }),
    getPositionSettings(),
  ]);

  return positions
    .map((position) => {
      const setting = settings.get(position.code);
      return {
        code: position.code,
        nameLo: position.nameLo,
        nameEn: position.nameEn,
        isManager: position.isManager === true,
        isActive: position.isActive !== false,
        level: setting?.level ?? DEFAULT_POSITION_LEVEL,
        sortOrder: setting?.sortOrder ?? 0,
      };
    })
    .sort(comparePositions);
}
