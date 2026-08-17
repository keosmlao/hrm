import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_LABEL } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { defaultKeysFor, MENU_ITEMS, ROLES } from "@/lib/menu";
import { RoleForm } from "./role-form";
import { UserPermissionList, type UserRow } from "./user-form";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  await requireRole("ADMIN");

  const [rows, users, accounts, overrides] = await Promise.all([
    prisma.menuPermission.findMany({ select: { role: true, menuKey: true } }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        role: true,
        employeeCode: true,
        employee: { select: { fullnameLo: true } },
      },
      orderBy: { username: "asc" },
    }),
    prisma.userMenuPermission.findMany({ select: { userId: true, menuKey: true } }),
  ]);

  const byRole = new Map<string, string[]>();
  for (const r of rows) byRole.set(r.role, [...(byRole.get(r.role) ?? []), r.menuKey]);
  const userCount = new Map(users.map((u) => [u.role as string, u._count]));

  const byUser = new Map<string, string[]>();
  for (const o of overrides) byUser.set(o.userId, [...(byUser.get(o.userId) ?? []), o.menuKey]);

  const userRows: UserRow[] = accounts.map((a) => ({
    id: a.id,
    username: a.username,
    employeeName: a.employee?.fullnameLo ?? null,
    employeeCode: a.employeeCode,
    role: a.role,
    roleLabel: ROLE_LABEL[a.role],
    override: byUser.get(a.id) ?? null,
    roleKeys: byRole.get(a.role) ?? defaultKeysFor(a.role),
  }));

  return (
    <>
      <PageHeader
        title="ສິດການເຂົ້າໃຊ້ເມນູ"
        subtitle={`ກຳນົດວ່າແຕ່ລະສິດເຫັນເມນູໃດແດ່ · ມີທັງໝົດ ${MENU_ITEMS.length} ເມນູ`}
      />

      <div className="mb-5 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="mb-1 font-semibold">ວິທີເຮັດວຽກ</p>
        <ul className="list-inside list-disc space-y-1 text-muted">
          <li>ບໍ່ຕິກ = ເຊື່ອງເມນູ <strong>ແລະ</strong> ເປີດ URL ນັ້ນບໍ່ໄດ້ (ຖືກສົ່ງກັບໜ້າຫຼັກ)</li>
          <li>role ທີ່ຍັງບໍ່ເຄີຍບັນທຶກ ຈະໃຊ້ຄ່າເລີ່ມຕົ້ນຂອງລະບົບໄປກ່ອນ</li>
          <li><strong>ADMIN ເຫັນທຸກເມນູສະເໝີ</strong> — ກັນຕັ້ງຄ່າຜິດແລ້ວລັອກຕົນເອງອອກ</li>
        </ul>
      </div>

      <h2 className="mt-6 mb-3 font-semibold">ສິດຕາມຕຳແໜ່ງ (ຄ່າພື້ນຖານ)</h2>
      <div className="space-y-5">
        {ROLES.filter((r) => r !== "ADMIN").map((role) => {
          const saved = byRole.get(role);
          return (
            <RoleForm
              key={role}
              role={role}
              label={ROLE_LABEL[role]}
              checked={saved ?? defaultKeysFor(role)}
              configured={Boolean(saved)}
              userCount={userCount.get(role) ?? 0}
            />
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 font-semibold">ສິດຕໍ່ພະນັກງານລາຍຄົນ (override)</h2>
      <UserPermissionList users={userRows} />
    </>
  );
}
