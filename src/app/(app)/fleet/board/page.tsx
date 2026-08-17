import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { livePositions } from "@/lib/fleet-live";
import { BoardView, type BoardVehicle, type Group } from "./board-view";

export const dynamic = "force-dynamic";

/** ກຸ່ມສຳລັບລົດທີ່ບໍ່ໄດ້ສັງກັດພະແນກ — ວາງໄວ້ທ້າຍສຸດສະເໝີ */
const SHARED = "__shared";

/** ຈຳນວນວັນຈົນບໍລິການ GPS ໝົດອາຍຸ — ຕິດລົບ = ໝົດແລ້ວ (ນອກ component ຕາມກົດ React) */
function daysLeft(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400_000);
}

export default async function FleetBoardPage() {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");

  const [vehicles, departments, divisions, positions] = await Promise.all([
    prisma.carVehicle.findMany({
      where: { status: { not: "retired" } },
      select: {
        id: true, plateNo: true, name: true, gpsImei: true, status: true,
        departmentCode: true, vehicleTypeId: true, currentMileage: true,
      },
      orderBy: { plateNo: "asc" },
    }),
    prisma.department.findMany({ select: { code: true, nameLo: true, divisionCode: true } }),
    prisma.division.findMany({ select: { code: true, nameLo: true } }),
    livePositions(),
  ]);

  const [types, gpsInfo] = await Promise.all([
    prisma.carVehicleType.findMany({ select: { id: true, name: true } }),
    prisma.vehicleGpsInfo.findMany(),
  ]);
  const typeMap = new Map(types.map((t) => [t.id.toString(), t.name]));
  const gpsMap = new Map(gpsInfo.map((g) => [g.imei, g]));

  const deptMap = new Map(departments.map((d) => [d.code, d]));
  const divMap = new Map(divisions.map((d) => [d.code, d.nameLo]));

  // ຈັດລົດເຂົ້າກຸ່ມຕາມພະແນກ — ພະແນກທີ່ບໍ່ມີລົດຈະບໍ່ຂຶ້ນ (ບໍ່ໃຫ້ມີບອດຫວ່າງລ້າໆ)
  const byDept = new Map<string, Group>();
  for (const v of vehicles) {
    const d = v.departmentCode ? deptMap.get(v.departmentCode) : undefined;
    const key = d?.code ?? SHARED;
    if (!byDept.has(key)) {
      byDept.set(key, {
        key,
        deptName: d?.nameLo ?? "ໃຊ້ຮ່ວມ (ບໍ່ສັງກັດພະແນກ)",
        divisionName: d ? (divMap.get(d.divisionCode) ?? d.divisionCode) : null,
        vehicles: [],
      });
    }
    const imei = v.gpsImei?.trim() || null;
    const g = imei ? gpsMap.get(imei) : undefined;
    const row: BoardVehicle = {
      id: v.id.toString(),
      plateNo: v.plateNo,
      name: v.name,
      imei,
      typeName: v.vehicleTypeId ? (typeMap.get(v.vehicleTypeId.toString()) ?? null) : null,
      mileage: v.currentMileage,
      deviceModel: g?.deviceModel ?? null,
      tankLitre: g?.tankLitre ?? null,
      kmPerLitre: g?.kmPerLitre ?? null,
      fuelMethod: g?.fuelMethod ?? null,
      expireDate: g?.expireDate ? g.expireDate.toISOString().slice(0, 10) : null,
      daysLeft: daysLeft(g?.expireDate ?? null),
    };
    byDept.get(key)!.vehicles.push(row);
  }

  // ຮຽງ: ພະແນກທີ່ມີລົດຫຼາຍກ່ອນ · ກຸ່ມ "ໃຊ້ຮ່ວມ" ທ້າຍສຸດ
  const groups = [...byDept.values()].sort((a, b) => {
    if (a.key === SHARED) return 1;
    if (b.key === SHARED) return -1;
    return b.vehicles.length - a.vehicles.length;
  });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });

  return (
    <>
      <PageHeader
        title="ບອດລົດຕາມພະແນກ"
        subtitle="ແຕ່ລະພະແນກມີລົດຈັກຄັນ ແລະ ຄັນໃດຢູ່ໃສ · ອັບເດດອັດຕະໂນມັດທຸກ 20 ວິນາທີ"
      />
      <BoardView groups={groups} initialPositions={positions} today={today} />
    </>
  );
}
