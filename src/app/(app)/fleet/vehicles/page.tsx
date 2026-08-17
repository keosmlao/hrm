import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/ui";
import { GpsImport } from "./gps-import";
import { VehicleTable, type VehicleRow } from "./vehicle-table";
import { TypeManager } from "./type-manager";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "green" | "amber" | "blue" | "gray" }> = {
  available: { label: "ຫວ່າງ", tone: "green" },
  in_use: { label: "ກຳລັງໃຊ້", tone: "blue" },
  maintenance: { label: "ສ້ອມແປງ", tone: "amber" },
  retired: { label: "ປົດລະວາງ", tone: "gray" },
};

/** ຈຳນວນວັນຈົນໝົດອາຍຸບໍລິການ GPS — ຕິດລົບ = ໝົດແລ້ວ */
function daysLeft(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400_000);
}

type BranchRow = { code: string; name: string; address: string | null };

export default async function VehiclesPage() {
  const session = await requireRole("ADMIN", "HR");
  const [vehicles, types, gpsInfo, departments, divisions, profiles, branches] = await Promise.all([
    prisma.carVehicle.findMany({ orderBy: { plateNo: "asc" } }),
    prisma.carVehicleType.findMany({ orderBy: { id: "asc" } }),
    prisma.vehicleGpsInfo.findMany(),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, nameLo: true, divisionCode: true },
    }),
    prisma.division.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, nameLo: true },
    }),
    prisma.vehicleProfile.findMany(),
    prisma.$queryRawUnsafe<BranchRow[]>(
      `select code, name, address
         from (
           select 'TRANSPORT'::varchar as code,
                  'ສາຂາຂົນສົ່ງ'::varchar as name,
                  null::varchar as address,
                  -1 as sort_order
           union all
           select code, name_1 as name, address_1 as address, number as sort_order
             from erp_branch_list
            where nullif(trim(code), '') is not null
              and nullif(trim(name_1), '') is not null
              and code <> '99'
         ) branches
        order by sort_order nulls last, code`,
    ),
  ]);
  const deptMap = new Map(departments.map((d) => [d.code, d]));
  const divMap = new Map(divisions.map((d) => [d.code, d.nameLo]));
  const typeMap = new Map(types.map((t) => [t.id.toString(), t.name]));
  const gpsMap = new Map(gpsInfo.map((g) => [g.imei, g]));
  const profileMap = new Map(profiles.map((profile) => [profile.vehicleId.toString(), profile]));
  const branchMap = new Map(branches.map((branch) => [branch.code, branch]));

  const linked = vehicles.filter((v) => v.gpsImei && gpsMap.has(v.gpsImei.trim()));
  const left = (v: (typeof vehicles)[number]) => daysLeft(gpsMap.get(v.gpsImei!.trim())!.expireDate);
  const expired = linked.filter((v) => (left(v) ?? 1) < 0).length;
  const expiringSoon = linked.filter((v) => {
    const d = left(v);
    return d != null && d >= 0 && d <= 30;
  }).length;

  const typeOptions = types.filter((t) => t.isActive).map((t) => ({ id: t.id.toString(), name: t.name }));
  const typeRows = types.map((t) => ({
    id: t.id.toString(),
    name: t.name,
    isActive: t.isActive,
    count: vehicles.filter((v) => v.vehicleTypeId?.toString() === t.id.toString()).length,
  }));
  const unassigned = vehicles.filter((v) => !v.departmentCode).length;
  const branchUnassigned = vehicles.filter((v) => !profileMap.get(v.id.toString())?.branchCode).length;

  // ແປງເປັນຂໍ້ມູນທຳມະດາ (ບໍ່ມີ BigInt/Date) ໃຫ້ client component ຄົ້ນຫາ/ກັ່ນຕອງເອງໄດ້
  const rows: VehicleRow[] = vehicles.map((v) => {
    const g = v.gpsImei ? gpsMap.get(v.gpsImei.trim()) : undefined;
    const d = v.departmentCode ? deptMap.get(v.departmentCode) : undefined;
    const st = v.status ? STATUS[v.status] : undefined;
    const profile = profileMap.get(v.id.toString());
    const branch = profile?.branchCode ? branchMap.get(profile.branchCode) : undefined;
    return {
      id: v.id.toString(),
      plateNo: v.plateNo,
      name: v.name,
      status: v.status,
      statusLabel: st?.label ?? null,
      statusTone: st?.tone ?? null,
      typeId: v.vehicleTypeId?.toString() ?? null,
      typeName: v.vehicleTypeId ? (typeMap.get(v.vehicleTypeId.toString()) ?? "-") : "-",
      category: g?.category ?? null,
      departmentCode: v.departmentCode,
      divisionCode: d?.divisionCode ?? null,
      divisionName: d ? (divMap.get(d.divisionCode) ?? d.divisionCode) : null,
      deptName: d?.nameLo ?? null,
      branchCode: profile?.branchCode ?? null,
      branchName: branch?.name ?? null,
      mileage: v.currentMileage,
      imei: v.gpsImei,
      deviceModel: g?.deviceModel ?? null,
      sim: g?.sim ?? null,
      hasCamera: Boolean(g?.hasCamera),
      fuelMethod: g?.fuelMethod ?? null,
      tankLitre: g?.tankLitre ?? null,
      kmPerLitre: g?.kmPerLitre ?? null,
      expireDate: g?.expireDate ? g.expireDate.toISOString().slice(0, 10) : null,
      daysLeft: daysLeft(g?.expireDate ?? null),
    };
  });

  return (
    <>
      <PageHeader
        title="ຈັດການລົດ"
        subtitle="ຂໍ້ມູນລົດຈາກລະບົບ ERP ຕໍ່ກັບຂໍ້ມູນອຸປະກອນຈາກ Lao GPS · ຜູກກັນດ້ວຍ IMEI"
      />

      <div className="mb-6 flex flex-wrap items-start gap-3">
        {/* ດຶງລົດຈາກ GPS ເຂົ້າຕາຕະລາງ ERP — ຂຽນ DB ຈຶ່ງໃຫ້ສະເພາະ ADMIN */}
        {session.role === "ADMIN" && (
          <div className="min-w-0 flex-1">
            <GpsImport />
          </div>
        )}
        <TypeManager types={typeRows} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="ລົດທັງໝົດ" value={vehicles.length} />
        <StatCard
          label="ຕໍ່ກັບ GPS ໄດ້"
          value={`${linked.length}/${vehicles.length}`}
          tone={linked.length === vehicles.length ? "good" : "warn"}
        />
        <StatCard
          label="ຍັງບໍ່ໄດ້ລະບຸພະແນກ"
          value={unassigned}
          tone={unassigned > 0 ? "warn" : "good"}
          hint="ຖືວ່າເປັນລົດໃຊ້ຮ່ວມ"
        />
        <StatCard
          label="ຍັງບໍ່ໄດ້ລະບຸສາຂາ"
          value={branchUnassigned}
          tone={branchUnassigned > 0 ? "warn" : "good"}
          hint="ເລືອກສາຂາໄດ້ຈາກປຸ່ມແກ້ໄຂ"
        />
        <StatCard
          label="ບໍລິການ GPS ໝົດອາຍຸແລ້ວ"
          value={expired}
          tone={expired > 0 ? "bad" : "good"}
          hint={expiringSoon > 0 ? `ອີກ ${expiringSoon} ຄັນຈະໝົດພາຍໃນ 30 ວັນ` : "ບໍ່ມີຄັນໃດໃກ້ໝົດ"}
        />
      </div>

      <VehicleTable
        rows={rows}
        types={typeOptions}
        departments={departments}
        divisions={divisions}
        branches={branches}
      />
    </>
  );
}
