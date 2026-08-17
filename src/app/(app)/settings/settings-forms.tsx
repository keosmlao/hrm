"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import {
  createHoliday,
  createLeaveType,
  createWorkShift,
  assignEmployeeShift,
  saveAttendanceCyclePolicy,
  saveAttendanceLocationPolicy,
  saveOvertimeRatePolicy,
  saveAttendancePolicy,
  type SettingsFormState,
} from "./actions";

const WORK_DAYS = [
  [1, "ຈັນ"],
  [2, "ອັງຄານ"],
  [3, "ພຸດ"],
  [4, "ພະຫັດ"],
  [5, "ສຸກ"],
  [6, "ເສົາ"],
  [0, "ອາທິດ"],
] as const;

function Message({ state }: { state: SettingsFormState }) {
  if (!state.error && !state.success) return null;
  return <p className={`text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.success}</p>;
}

export function AttendancePolicyForm({ workStart, workEnd, lateGraceMinutes }: { workStart: string; workEnd: string; lateGraceMinutes: number }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveAttendancePolicy, {});
  return <form action={action} className="grid gap-4 sm:grid-cols-3">
    <Field label="ເວລາເຂົ້າວຽກ" required><input name="workStart" type="time" required defaultValue={workStart} className={inputClass} /></Field>
    <Field label="ເວລາອອກວຽກ" required><input name="workEnd" type="time" required defaultValue={workEnd} className={inputClass} /></Field>
    <Field label="ຜ່ອນຜັນການມາຊ້າ (ນາທີ)" required><input name="lateGraceMinutes" type="number" min="0" max="180" required defaultValue={lateGraceMinutes} className={inputClass} /></Field>
    <div className="sm:col-span-2"><Message state={state} /></div>
    <Button type="submit" disabled={pending}>{pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກນະໂຍບາຍ"}</Button>
  </form>;
}

export function AttendanceCyclePolicyForm({ endDay }: { endDay: number }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveAttendanceCyclePolicy, {});
  return <form action={action} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
    <Field label="ວັນປິດຮອບ" hint="ເລືອກໄດ້ວັນທີ 1–27" required>
      <input name="endDay" type="number" min="1" max="27" required defaultValue={endDay} className={inputClass} />
    </Field>
    <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm">
      <p className="text-muted">ຮອບປັດຈຸບັນ</p>
      <p className="mt-1 font-medium">ວັນທີ {endDay + 1} ເດືອນກ່ອນ – ວັນທີ {endDay} ເດືອນນີ້</p>
    </div>
    <Button type="submit" disabled={pending} className="self-end">
      {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຮອບ"}
    </Button>
    <div className="sm:col-span-3"><Message state={state} /></div>
  </form>;
}

export function AttendanceLocationPolicyForm({
  required,
  latitude,
  longitude,
  radiusMeters,
}: {
  required: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
}) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveAttendanceLocationPolicy, {});
  return <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Field label="Latitude" required><input name="latitude" type="number" step="any" min="-90" max="90" required defaultValue={latitude ?? ""} placeholder="17.9757" className={inputClass} /></Field>
    <Field label="Longitude" required><input name="longitude" type="number" step="any" min="-180" max="180" required defaultValue={longitude ?? ""} placeholder="102.6331" className={inputClass} /></Field>
    <Field label="ລັດສະໝີ (ແມັດ)" required><input name="radiusMeters" type="number" min="10" max="50000" required defaultValue={radiusMeters} className={inputClass} /></Field>
    <label className="flex items-center gap-2 self-end pb-3 text-sm"><input name="required" type="checkbox" defaultChecked={required} />ບັງຄັບໃຫ້ຢູ່ໃນພື້ນທີ່</label>
    <div className="sm:col-span-2 lg:col-span-3"><Message state={state} /></div>
    <Button type="submit" disabled={pending}>{pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກສະຖານທີ່"}</Button>
  </form>;
}

export function OvertimeRatePolicyForm({
  workdayRate,
  dayOffRate,
  holidayRate,
}: {
  workdayRate: number;
  dayOffRate: number;
  holidayRate: number;
}) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveOvertimeRatePolicy, {});
  return <form action={action} className="grid gap-4 sm:grid-cols-3">
    <Field label="ວັນເຮັດວຽກປົກກະຕິ" hint="ເຊັ່ນ 1.5 ເທົ່າ" required><input name="workdayRate" type="number" step="0.01" min="1" max="10" required defaultValue={workdayRate} className={inputClass} /></Field>
    <Field label="ວັນພັກຕາມຕາຕະລາງ" hint="ລວມວັນພັກລາຍຄົນ" required><input name="dayOffRate" type="number" step="0.01" min="1" max="10" required defaultValue={dayOffRate} className={inputClass} /></Field>
    <Field label="ວັນພັກບໍລິສັດ/ວັນບຸນ" required><input name="holidayRate" type="number" step="0.01" min="1" max="10" required defaultValue={holidayRate} className={inputClass} /></Field>
    <div className="sm:col-span-2"><Message state={state} /></div>
    <Button type="submit" disabled={pending}>{pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກອັດຕາ OT"}</Button>
  </form>;
}

export function NewLeaveTypeForm() {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(createLeaveType, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <Field label="ລະຫັດ" required><input name="code" required placeholder="ANNUAL" className={inputClass} /></Field>
    <Field label="ຊື່" required><input name="name" required className={inputClass} /></Field>
    <Field label="ຈຳນວນວັນ / ປີ" required><input name="daysPerYear" type="number" min="0" max="366" required defaultValue="0" className={inputClass} /></Field>
    <div className="flex flex-wrap items-end gap-4 pb-2 text-sm"><label><input name="isPaid" type="checkbox" defaultChecked className="mr-2" />ຮັບເງິນເດືອນ</label><label><input name="requiresProof" type="checkbox" className="mr-2" />ຕ້ອງມີຫຼັກຖານ</label></div>
    <div><Message state={state} /></div><Button type="submit" disabled={pending}>{pending ? "ກຳລັງເພີ່ມ..." : "ເພີ່ມປະເພດ"}</Button>
  </form>;
}

export function NewHolidayForm() {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(createHoliday, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <Field label="ຊື່ວັນພັກ" required><input name="name" required className={inputClass} /></Field>
    <Field label="ວັນທີ" required><input name="date" type="date" required className={inputClass} /></Field>
    <div><Message state={state} /></div><Button type="submit" disabled={pending}>{pending ? "ກຳລັງເພີ່ມ..." : "ເພີ່ມວັນພັກ"}</Button>
  </form>;
}

export function NewWorkShiftForm() {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(createWorkShift, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="ລະຫັດກະ" required><input name="code" required placeholder="SHIFT_1" className={inputClass} /></Field>
    <Field label="ຊື່ກະ" required><input name="name" required placeholder="ກະເຊົ້າ" className={inputClass} /></Field>
    <Field label="ເວລາເລີ່ມ" required><input name="startTime" type="time" required className={inputClass} /></Field>
    <Field label="ເວລາສິ້ນສຸດ" required><input name="endTime" type="time" required className={inputClass} /></Field>
    <Field label="ພັກ (ນາທີ)" required><input name="breakMinutes" type="number" min="0" max="480" defaultValue="60" required className={inputClass} /></Field>
    <Field label="ຜ່ອນຜັນມາຊ້າ (ນາທີ)" required><input name="lateGraceMinutes" type="number" min="0" max="180" defaultValue="15" required className={inputClass} /></Field>
    <Field label="ການຈັດວັນພັກ" required><Combobox name="scheduleType" defaultValue="WEEKDAYS" options={[{ value: "WEEKDAYS", label: "ຕາມວັນເຮັດວຽກທີ່ເລືອກ" }, { value: "ROTATING", label: "ກະວຽນ / ກຳນົດວັນພັກລາຍເດືອນ" }]} /></Field>
    <fieldset className="sm:col-span-2 lg:col-span-3">
      <legend className="mb-2 text-sm font-medium">ວັນເຮັດວຽກ <span className="text-rose-600">*</span></legend>
      <div className="flex flex-wrap gap-2">
        {WORK_DAYS.map(([value, label]) => (
          <label key={value} className="flex min-w-24 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
            <input name="workDay" type="checkbox" value={value} defaultChecked={value >= 1 && value <= 5} />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">ເລືອກໄດ້ຫຼາຍວັນ; ຕ້ອງເລືອກຢ່າງໜ້ອຍ 1 ວັນ</p>
    </fieldset>
    <div className="lg:col-span-2"><Message state={state} /></div><Button type="submit" disabled={pending}>{pending ? "ກຳລັງເພີ່ມ..." : "ເພີ່ມກະ"}</Button>
  </form>;
}

export function AssignShiftForm({ employees, shifts }: { employees: { code: string; name: string }[]; shifts: { id: string; code: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(assignEmployeeShift, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="ພະນັກງານ" required><Combobox name="employeeCode" required placeholder="— ເລືອກ —" options={employees.map((employee) => ({ value: employee.code, label: `${employee.code} · ${employee.name}` }))} /></Field>
    <Field label="ກະເຮັດວຽກ" required><Combobox name="shiftId" required placeholder="— ເລືອກ —" options={shifts.map((shift) => ({ value: shift.id, label: `${shift.code} · ${shift.name}` }))} /></Field>
    <Field label="ວັນເລີ່ມ" required><input name="effectiveFrom" type="date" required className={inputClass} /></Field>
    <Field label="ວັນສິ້ນສຸດ"><input name="effectiveTo" type="date" className={inputClass} /></Field>
    <Field label="ໝາຍເຫດ"><input name="note" className={inputClass} /></Field>
    <div className="self-end"><Message state={state} /></div>
    <Button type="submit" disabled={pending} className="lg:col-span-3">{pending ? "ກຳລັງມອບ..." : "ມອບກະໃຫ້ພະນັກງານ"}</Button>
  </form>;
}
