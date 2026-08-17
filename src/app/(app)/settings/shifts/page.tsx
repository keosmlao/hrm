import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDefaultShiftId } from "@/lib/hrm-settings";
import { Card, EmptyRow, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { NewWorkShiftForm } from "../settings-forms";
import {
  assignDefaultShiftToAll,
  deleteWorkShift,
  setDefaultShift,
  updateWorkShift,
} from "../actions";
import { DeleteShiftButton } from "../delete-shift-button";

const WORK_DAY_OPTIONS = [
  [1, "ຈ"],
  [2, "ອ"],
  [3, "ພ"],
  [4, "ພຫ"],
  [5, "ສ"],
  [6, "ສອ"],
  [0, "ອາ"],
] as const;

export default async function ShiftSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shiftMessage?: string; shiftError?: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const { shiftMessage, shiftError } = await searchParams;
  const [shifts, defaultShiftId] = await Promise.all([
    prisma.workShift.findMany({ orderBy: { code: "asc" } }),
    getDefaultShiftId(),
  ]);
  const effectiveDefaultId =
    defaultShiftId && shifts.some((s) => s.id === defaultShiftId && s.isActive)
      ? defaultShiftId
      : shifts.find((s) => s.isActive)?.id;

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າກະເຮັດວຽກ"
        subtitle="ເພີ່ມ–ລຶບກະ ແລະ ກຳນົດວັນເຮັດວຽກ (ມອບກະໃຫ້ພະນັກງານ ເຮັດຢູ່ໜ້າຂໍ້ມູນພະນັກງານ)"
      />

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">ເພີ່ມກະເຮັດວຽກ</h2>
        <NewWorkShiftForm />
      </Card>

      {(shiftMessage || shiftError) && (
        <p className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          shiftError
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {shiftError ?? shiftMessage}
        </p>
      )}

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">ກະເລີ່ມຕົ້ນ (default)</h2>
          <p className="text-xs text-muted">
            ພະນັກງານທີ່ບໍ່ໄດ້ມອບກະສະເພາະ ຈະໃຊ້ກະນີ້ອັດຕະໂນມັດ · ຕິກ “ຕັ້ງເລີ່ມຕົ້ນ” ຢູ່ຕາຕະລາງລຸ່ມ
          </p>
        </div>
        <form action={assignDefaultShiftToAll}>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-110">
            ມອບກະເລີ່ມຕົ້ນໃຫ້ພະນັກງານທຸກຄົນ
          </button>
        </form>
      </Card>

      <h2 className="mb-3 font-semibold">ກະເຮັດວຽກ ({shifts.length})</h2>
      <div className="mb-8">
        <Table>
          <thead><tr><Th>ລະຫັດ</Th><Th>ຊື່ກະ</Th><Th>ເລີ່ມ</Th><Th>ສິ້ນສຸດ</Th><Th>ພັກ</Th><Th>ຜ່ອນຜັນ</Th><Th>ຕາຕະລາງ</Th><Th>ວັນເຮັດວຽກ</Th><Th>ເປີດ</Th><Th></Th></tr></thead>
          <tbody>
            {shifts.length === 0 && <EmptyRow colSpan={10} />}
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <Td className="align-top font-medium">
                  <div className="flex flex-col gap-1">
                    <span>{shift.code}</span>
                    {effectiveDefaultId === shift.id ? (
                      <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        ★ ເລີ່ມຕົ້ນ
                      </span>
                    ) : (
                      shift.isActive && (
                        <form action={setDefaultShift.bind(null, shift.id)}>
                          <button className="text-[10px] text-primary hover:underline">
                            ຕັ້ງເລີ່ມຕົ້ນ
                          </button>
                        </form>
                      )
                    )}
                  </div>
                </Td>
                <Td colSpan={9}>
                  <form action={updateWorkShift.bind(null, shift.id)} className="grid min-w-[1180px] grid-cols-[2fr_100px_100px_90px_90px_160px_280px_70px_80px] items-center gap-3">
                    <input name="name" required defaultValue={shift.name} className={inputClass} />
                    <input name="startTime" required type="time" defaultValue={shift.startTime} className={inputClass} />
                    <input name="endTime" required type="time" defaultValue={shift.endTime} className={inputClass} />
                    <input name="breakMinutes" required type="number" min="0" max="480" defaultValue={shift.breakMinutes} className={inputClass} />
                    <input name="lateGraceMinutes" required type="number" min="0" max="180" defaultValue={shift.lateGraceMinutes} className={inputClass} />
                    <Combobox name="scheduleType" defaultValue={shift.scheduleType} options={[{ value: "WEEKDAYS", label: "ຕາມວັນທີ່ເລືອກ" }, { value: "ROTATING", label: "ກະວຽນ" }]} />
                    <div className="flex items-center gap-2">
                      {WORK_DAY_OPTIONS.map(([value, label]) => (
                        <label key={value} title={label} className="flex items-center gap-1 text-xs">
                          <input name="workDay" type="checkbox" value={value} defaultChecked={shift.workDays.split(",").includes(String(value))} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label className="text-center"><input name="isActive" type="checkbox" defaultChecked={shift.isActive} /></label>
                    <div className="flex items-center gap-2">
                      <button className="text-xs font-medium text-primary hover:underline">ບັນທຶກ</button>
                      <DeleteShiftButton code={shift.code} deleteAction={deleteWorkShift.bind(null, shift.id)} />
                    </div>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

    </>
  );
}

export const dynamic = "force-dynamic";
