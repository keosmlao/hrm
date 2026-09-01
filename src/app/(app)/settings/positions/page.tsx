import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, EmptyRow, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { POSITION_LEVELS } from "@/lib/position-level";
import { listPositions } from "@/lib/positions";
import { NewPositionForm } from "./position-forms";
import { deletePosition, updatePosition } from "./actions";

export default async function PositionSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ positionMessage?: string; positionError?: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const { positionMessage, positionError } = await searchParams;

  const [positions, staffPerPosition, postingsPerPosition] = await Promise.all([
    listPositions(),
    prisma.employee.groupBy({ by: ["positionCode"], _count: true }),
    prisma.jobPosting.groupBy({ by: ["positionCode"], _count: true }),
  ]);

  const staffCount = new Map(staffPerPosition.map((s) => [s.positionCode ?? "", s._count]));
  const postingCount = new Map(postingsPerPosition.map((p) => [p.positionCode ?? "", p._count]));

  return (
    <>
      <PageHeader
        title="ກຳນົດຕຳແໜ່ງ"
        subtitle="ເພີ່ມ ແລະ ແກ້ໄຂຕຳແໜ່ງງານ, ລະດັບ ແລະ ລຳດັບແສດງ — ໃຊ້ຢູ່ຟອມພະນັກງານ, ຜັງອົງກອນ, ການຮັບສະໝັກ ແລະ ກຳນົດສິດຕອນເຂົ້າລະບົບ"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມຕຳແໜ່ງ</h2>
        <NewPositionForm positionCodes={positions.map((p) => p.code)} />
      </Card>

      {(positionMessage || positionError) && (
        <p
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            positionError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {positionError ?? positionMessage}
        </p>
      )}

      <h2 className="mb-3 font-semibold">ຕຳແໜ່ງທັງໝົດ ({positions.length})</h2>
      <Table>
        <thead>
          <tr>
            <Th className="w-28">ລະຫັດ</Th>
            <Th>ຊື່ຕຳແໜ່ງ (ລາວ)</Th>
            <Th>ຊື່ (ອັງກິດ)</Th>
            <Th className="w-44">ລະດັບຕຳແໜ່ງ</Th>
            <Th className="w-20">ລຳດັບ</Th>
            <Th className="w-24">ລະດັບຫົວໜ້າ</Th>
            <Th className="w-24">ພະນັກງານ</Th>
            <Th className="w-20">ເປີດໃຊ້</Th>
            <Th className="w-32"></Th>
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && <EmptyRow colSpan={9} />}
          {positions.map((position) => {
            const staff = staffCount.get(position.code) ?? 0;
            const postings = postingCount.get(position.code) ?? 0;
            // ຟອມຢູ່ນອກຊ່ອງ ແລ້ວໃຫ້ຊ່ອງຕ່າງໆອ້າງດ້ວຍ form="..." — ຖັນຈຶ່ງຕົງກັບຫົວຕາຕະລາງ
            const formId = `position-${position.code}`;
            return (
              <tr key={position.code}>
                <Td className="font-medium">
                  {position.code}
                  <form id={formId} action={updatePosition.bind(null, position.code)} />
                </Td>
                <Td>
                  <input
                    form={formId}
                    name="nameLo"
                    required
                    maxLength={200}
                    defaultValue={position.nameLo}
                    className={inputClass}
                  />
                </Td>
                <Td>
                  <input
                    form={formId}
                    name="nameEn"
                    maxLength={200}
                    defaultValue={position.nameEn ?? ""}
                    className={inputClass}
                  />
                </Td>
                <Td>
                  <select form={formId} name="level" defaultValue={position.level} className={inputClass}>
                    {POSITION_LEVELS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <input
                    form={formId}
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={999}
                    defaultValue={position.sortOrder}
                    className={inputClass}
                  />
                </Td>
                <Td className="text-center">
                  <input
                    form={formId}
                    name="isManager"
                    type="checkbox"
                    defaultChecked={position.isManager}
                  />
                </Td>
                <Td className="text-sm text-muted">{staff} ຄົນ</Td>
                <Td className="text-center">
                  <input
                    form={formId}
                    name="isActive"
                    type="checkbox"
                    defaultChecked={position.isActive}
                  />
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <button form={formId} className="text-xs font-medium text-primary hover:underline">
                      ບັນທຶກ
                    </button>
                    {staff === 0 && postings === 0 && (
                      <button
                        form={formId}
                        formAction={deletePosition.bind(null, position.code)}
                        formNoValidate
                        className="text-xs text-rose-600 hover:underline"
                      >
                        ລຶບ
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

export const dynamic = "force-dynamic";
