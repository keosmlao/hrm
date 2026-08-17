import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { laoDate } from "@/lib/format";
import { ACTIVE_EMPLOYEE } from "@/lib/employee-status";
import { AssignAssetForm, CreateAssetForm } from "./asset-forms";
import { AssetTable, type AssetRow } from "./asset-table";
import { returnAsset } from "./actions";

export const dynamic = "force-dynamic";

/**
 * ຊັບສິນ ແລະ ອຸປະກອນ.
 *
 * ທະບຽນຫຼັກຄື `as_asset` ຂອງ **SML** — HRM ອ່ານ ແລະ ແກ້ໄດ້.
 * ການມອບ-ສົ່ງຄືນເປັນຂອງ HRM (`hrm_asset_assignment`) ຜູກດ້ວຍລະຫັດຊັບສິນ
 * ຈຶ່ງໄດ້ຜູ້ຖືຄອງທີ່**ຜູກກັບລະຫັດພະນັກງານແທ້** ຕ່າງຈາກ SML ທີ່ເກັບເປັນຂໍ້ຄວາມ.
 */
export default async function AssetsPage() {
  await requireRole("ADMIN", "HR");

  const [assets, types, locations, departments, branches, assignments, employees] = await Promise.all([
    prisma.smlAsset.findMany({ orderBy: { code: "asc" } }),
    prisma.smlAssetType.findMany({ orderBy: { code: "asc" } }),
    prisma.smlAssetLocation.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ select: { code: true, nameLo: true }, orderBy: { code: "asc" } }),
    prisma.$queryRawUnsafe<{ code: string; name: string }[]>(
      `select code, name_1 as name from erp_branch_list where code <> '99' order by code`,
    ).catch(() => []),
    prisma.assetAssignment.findMany({
      where: { returnedDate: null },
      include: { employee: { select: { fullnameLo: true } } },
      orderBy: { assignedDate: "desc" },
    }),
    prisma.employee.findMany({
      where: ACTIVE_EMPLOYEE,
      select: { code: true, fullnameLo: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const typeMap = new Map(types.map((t) => [t.code, t.name ?? t.code]));
  const locMap = new Map(locations.map((l) => [l.code, l.name ?? l.code]));
  const deptMap = new Map(departments.map((d) => [d.code, d.nameLo]));
  const branchMap = new Map(branches.map((b) => [b.code, b.name]));
  const assignedMap = new Map(assignments.map((a) => [a.assetCode, a.employee.fullnameLo]));

  const rows: AssetRow[] = assets.map((a) => ({
    code: a.code,
    name: a.name ?? "",
    typeCode: a.typeCode || null,
    typeName: a.typeCode ? (typeMap.get(a.typeCode) ?? a.typeCode) : null,
    locationCode: a.locationCode || null,
    locationName: a.locationCode ? (locMap.get(a.locationCode) ?? a.locationCode) : null,
    departmentCode: a.departmentCode || null,
    departmentName: a.departmentCode ? (deptMap.get(a.departmentCode) ?? a.departmentCode) : null,
    branchCode: a.branchCode || null,
    branchName: a.branchCode ? (branchMap.get(a.branchCode) ?? a.branchCode) : null,
    brand: a.brand || null,
    modelInfo: a.modelInfo || null,
    serialNo: a.serialNo || null,
    unitCode: a.unitCode || null,
    holderName: a.holderName || null,
    remark: a.remark || null,
    status: a.status,
    assignedTo: assignedMap.get(a.code) ?? null,
  }));

  const inUse = rows.filter((r) => r.assignedTo).length;
  const noHolder = rows.filter((r) => !r.assignedTo && !r.holderName).length;

  return (
    <>
      <PageHeader
        title="ຊັບສິນ ແລະ ອຸປະກອນ"
        subtitle="ທະບຽນຈາກ SML · ມອບ-ສົ່ງຄືນຈັດການໃນ HRM"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ຊັບສິນທັງໝົດ" value={rows.length} />
        <StatCard label="ມອບຜ່ານ HRM ແລ້ວ" value={inUse} tone="good" hint="ຜູກກັບລະຫັດພະນັກງານ" />
        <StatCard
          label="ມີຜູ້ຖືຄອງໃນ SML"
          value={rows.filter((r) => !r.assignedTo && r.holderName).length}
          hint="ເປັນຂໍ້ຄວາມ ຍັງບໍ່ໄດ້ຜູກລະຫັດ"
        />
        <StatCard
          label="ຍັງບໍ່ມີຜູ້ຖືຄອງ"
          value={noHolder}
          tone={noHolder > 0 ? "warn" : "good"}
        />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">ເພີ່ມຊັບສິນ</h2>
          <CreateAssetForm
            types={types.map((t) => ({ code: t.code, name: t.name ?? t.code }))}
            locations={locations.map((l) => ({ code: l.code, name: l.name ?? l.code }))}
            departments={departments.map((d) => ({ code: d.code, name: d.nameLo }))}
            branches={branches.map((b) => ({ code: b.code, name: b.name }))}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">ມອບຊັບສິນໃຫ້ພະນັກງານ</h2>
          <AssignAssetForm
            assets={rows
              .filter((r) => !r.assignedTo)
              .map((r) => ({ code: r.code, name: r.name }))}
            employees={employees.map((e) => ({ code: e.code, name: e.fullnameLo }))}
          />
        </Card>
      </div>

      <h2 className="mb-3 font-semibold">ກຳລັງຖືກໃຊ້ ({assignments.length})</h2>
      <div className="mb-8">
        <Table>
          <thead>
            <tr>
              <Th>ຊັບສິນ</Th>
              <Th>ພະນັກງານ</Th>
              <Th>ວັນທີມອບ</Th>
              <Th>ສະພາບ</Th>
              <Th>ສົ່ງຄືນ</Th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && <EmptyRow colSpan={5} text="ຍັງບໍ່ມີການມອບຜ່ານ HRM" />}
            {assignments.map((a) => (
              <tr key={a.id}>
                <Td className="tabular">
                  {a.assetCode}
                  <span className="block text-xs text-muted">
                    {rows.find((r) => r.code === a.assetCode)?.name ?? "—"}
                  </span>
                </Td>
                <Td>{a.employee.fullnameLo}</Td>
                <Td>{laoDate(a.assignedDate)}</Td>
                <Td>{a.condition ?? "-"}</Td>
                <Td>
                  <form action={returnAsset.bind(null, a.id)} className="flex gap-2">
                    <input name="returnedDate" type="date" required className="rounded-md border border-border px-2 py-1 text-xs" />
                    <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-slate-50">ຮັບຄືນ</button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <AssetTable
        rows={rows}
        types={types.map((t) => ({ code: t.code, name: t.name ?? t.code }))}
        locations={locations.map((l) => ({ code: l.code, name: l.name ?? l.code }))}
        departments={departments.map((d) => ({ code: d.code, name: d.nameLo }))}
        branches={branches.map((b) => ({ code: b.code, name: b.name }))}
      />
    </>
  );
}
