"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { renderMarkdown } from "@/lib/markdown";

export type Me =
  | {
      linked: true;
      code: string;
      name: string;
      profile: {
        title: string | null; nickname: string | null; mobile: string | null; email: string | null;
        address: string | null; photoUrl: string | null; hrStatus: string | null; position: string | null;
        division: string | null; department: string | null; unit: string | null; hireDate: string | null;
      };
      shift: { code: string | null; name: string | null; startTime: string; endTime: string; breakMinutes: number };
      today: { checkInAt: string | null; checkOutAt: string | null; lateMinutes: number; workedMinutes: number | null } | null;
      leave: {
        types: { id: string; name: string; entitled: number; used: number; carriedOver: number; remaining: number; requiresProof: boolean }[];
        requests: { id: string; type: string; startDate: string; endDate: string; days: number; status: string; reason: string | null; rejectReason: string | null }[];
      };
      overtime: { id: string; workDate: string; startTime: string; endTime: string; hours: number; rate: number; status: string; reason: string | null; rejectReason: string | null }[];
      payslips: { id: string; year: number; month: number; status: string; grossPay: number; totalDeduction: number; netPay: number }[];
      trips: { id: string; date: string; endDate: string; tripNo: number; destination: string; departTime: string | null; returnTime: string | null; status: string; vehiclePlate: string | null; rejectReason: string | null; approvalLevel: number; totalApprovalSteps: number; currentStepLabel: string | null }[];
      approvals: { id: string; destination: string; requester: string; date: string; endDate: string; departTime: string | null; returnTime: string | null; tripNo: number; note: string | null; members: string[]; stepLabel: string; stepIndex: number; totalSteps: number }[];
      knowledge: { pendingAck: number };
    }
  | { linked: false; lineName: string | null };

type LinkedMe = Extract<Me, { linked: true }>;
type AppTab = "HOME" | "LEAVE" | "OT" | "PAY" | "TRIP" | "KB" | "PROFILE";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ຮ່າງ",
  PENDING_MANAGER: "ລໍຖ້າຫົວໜ້າ",
  PENDING_HR: "ລໍຖ້າ HR",
  APPROVED: "ອະນຸມັດ",
  REJECTED: "ປະຕິເສດ",
  CANCELLED: "ຍົກເລີກ",
  PAID: "ຈ່າຍແລ້ວ",
  CLOSED: "ປິດຮອບ",
  // trip
  PENDING: "ລໍຖ້າອະນຸມັດ",
  PLANNED: "ອະນຸມັດ · ຈັດລົດແລ້ວ",
  DEPARTED: "ອອກແລ້ວ",
  RETURNED: "ກັບແລ້ວ",
};

const MONTH_LABEL = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];

export function EmployeeApp({
  me,
  idToken,
  busy,
  onClock,
  onChanged,
  onLogout,
}: {
  me: LinkedMe;
  idToken?: string;
  busy: boolean;
  onClock: (action: "IN" | "OUT") => void;
  onChanged: () => Promise<void>;
  onLogout?: () => void;
}) {
  // ຈື່ແທັບປັດຈຸບັນ — refresh ແລ້ວຄ້າງຢູ່ແທັບເກົ່າ
  const [tab, setTabState] = useState<AppTab>(() => {
    if (typeof window === "undefined") return "HOME";
    const saved = window.localStorage.getItem("emp_tab");
    return saved === "HOME" || saved === "LEAVE" || saved === "OT" || saved === "PAY" || saved === "TRIP" || saved === "KB" || saved === "PROFILE" ? saved : "HOME";
  });
  const setTab = (next: AppTab) => {
    setTabState(next);
    if (typeof window !== "undefined") window.localStorage.setItem("emp_tab", next);
  };
  return <div className="mx-auto min-h-screen w-full max-w-md pb-24 md:max-w-3xl md:pb-6">
    <header className="bg-gradient-to-br from-emerald-700 to-emerald-500 px-5 pb-8 pt-5 text-white md:rounded-b-3xl">
      <div className="flex items-center gap-3">
        {me.profile.photoUrl ? <Image src={me.profile.photoUrl} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-full border-2 border-white/70 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 font-bold">OD</div>}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-emerald-100">ສະບາຍດີ</p>
          <h1 className="truncate text-lg font-semibold">{me.profile.title ?? ""} {me.name}</h1>
          <p className="text-xs text-emerald-100">{me.code} · {me.profile.position ?? "ພະນັກງານ"}</p>
        </div>
        {onLogout && <button onClick={onLogout} className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25">ອອກ</button>}
      </div>
    </header>

    <main className="-mt-4 space-y-4 px-4 md:px-6">
      {tab === "HOME" && <>
        {me.approvals.length > 0 && <button onClick={() => setTab("TRIP")} className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-left text-white shadow-sm">
          <p className="text-sm font-semibold">🔔 ມີ {me.approvals.length} ຄຳຮ້ອງລໍຖ້າທ່ານອະນຸມັດ</p>
          <p className="text-xs text-amber-50">ແຕະເພື່ອກວດ ແລະ ອະນຸມັດ/ປະຕິເສດ</p>
        </button>}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className="font-semibold">ລົງເວລາມື້ນີ້</h2><p className="mt-1 text-xs text-slate-500">{me.shift.name ?? "ກະຫ້ອງການ"} · {me.shift.startTime}–{me.shift.endTime}</p></div>
            {(me.today?.lateMinutes ?? 0) > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">ຊ້າ {me.today?.lateMinutes} ນທ</span>}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-slate-500">ເຂົ້າວຽກ</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtTime(me.today?.checkInAt ?? null)}</p></div>
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-slate-500">ອອກວຽກ</p><p className="mt-1 text-xl font-semibold tabular-nums">{fmtTime(me.today?.checkOutAt ?? null)}</p></div>
          </div>
          {!me.today?.checkInAt ? <button onClick={() => onClock("IN")} disabled={busy} className="w-full rounded-xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50">{busy ? "ກຳລັງບັນທຶກ..." : "ເຂົ້າວຽກ"}</button> : !me.today?.checkOutAt ? <button onClick={() => onClock("OUT")} disabled={busy} className="w-full rounded-xl bg-rose-600 py-4 font-semibold text-white disabled:opacity-50">{busy ? "ກຳລັງບັນທຶກ..." : "ອອກວຽກ"}</button> : <p className="rounded-xl bg-emerald-50 py-3 text-center text-sm font-medium text-emerald-700">✓ ລົງເວລາຄົບແລ້ວ · {fmtWorked(me.today.workedMinutes)}</p>}
        </section>
        {me.knowledge.pendingAck > 0 && <button onClick={() => setTab("KB")} className="w-full rounded-2xl bg-sky-600 px-5 py-4 text-left text-white shadow-sm">
          <p className="text-sm font-semibold">📖 ມີ {me.knowledge.pendingAck} ບົດທີ່ຕ້ອງອ່ານ ແລະ ຮັບຮູ້</p>
          <p className="text-xs text-sky-50">ແຕະເພື່ອອ່ານ ນະໂຍບາຍ / ຄູ່ມືວຽກ ສະບັບຫຼ້າສຸດ</p>
        </button>}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickCard label="ວັນລາເຫຼືອ" value={String(Math.max(0, me.leave.types.reduce((sum, item) => sum + item.remaining, 0)))} onClick={() => setTab("LEAVE")} />
          <QuickCard label="OT ຂອງຂ້ອຍ" value={String(me.overtime.length)} onClick={() => setTab("OT")} />
          <QuickCard label="ອອກຕະຫຼາດ / Trip" value={String(me.trips.length)} onClick={() => setTab("TRIP")} />
          <QuickCard label="ສະລິບ" value={String(me.payslips.length)} onClick={() => setTab("PAY")} />
        </section>
        <button onClick={() => setTab("KB")} className="w-full rounded-2xl bg-white px-5 py-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300">
          <p className="text-sm font-semibold">📚 ຄັງຄວາມຮູ້</p>
          <p className="text-xs text-slate-500">ນະໂຍບາຍ, ຄູ່ມືວຽກ ແລະ ຂັ້ນຕອນປະຕິບັດງານ</p>
        </button>
      </>}

      {tab === "LEAVE" && <Section title="ການລາຂອງຂ້ອຍ">
        <EmployeeLeaveForm idToken={idToken} types={me.leave.types} onSaved={onChanged} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{me.leave.types.map((type) => <div key={type.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{type.name}</p><p className="mt-1 text-xl font-semibold">{type.remaining} <span className="text-xs font-normal">ວັນ</span></p><p className="text-[11px] text-slate-400">ໃຊ້ແລ້ວ {type.used}</p></div>)}</div>
        <h3 className="mb-2 mt-5 text-sm font-semibold">ຄຳຂໍຫຼ້າສຸດ</h3>
        <ListEmpty when={me.leave.requests.length === 0} text="ຍັງບໍ່ມີຄຳຂໍລາ" />
        {me.leave.requests.map((item) => <ListRow key={item.id} title={`${item.type} · ${item.days} ວັນ`} subtitle={`${fmtDate(item.startDate)}–${fmtDate(item.endDate)}`} status={item.status} />)}
      </Section>}

      {tab === "OT" && <Section title="OT ຂອງຂ້ອຍ">
        <EmployeeOvertimeForm idToken={idToken} onSaved={onChanged} />
        <ListEmpty when={me.overtime.length === 0} text="ຍັງບໍ່ມີຄຳຂໍ OT" />
        {me.overtime.map((item) => <ListRow key={item.id} title={`${item.hours} ຊມ · ${item.rate}×`} subtitle={`${fmtDate(item.workDate)} · ${item.startTime}–${item.endTime}`} status={item.status} />)}
      </Section>}

      {tab === "PAY" && <Section title="ສະລິບເງິນເດືອນ">
        <ListEmpty when={me.payslips.length === 0} text="ຍັງບໍ່ມີສະລິບທີ່ອະນຸມັດ" />
        {me.payslips.map((slip) => <div key={slip.id} className="mb-2 rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div><p className="font-medium">{MONTH_LABEL[slip.month - 1]} {slip.year}</p><p className="text-xs text-slate-500">ລາຍຮັບ {fmtKip(slip.grossPay)} · ຫັກ {fmtKip(slip.totalDeduction)}</p></div><div className="text-right"><p className="font-semibold text-emerald-700">{fmtKip(slip.netPay)}</p><p className="text-[11px] text-slate-400">ຮັບສຸດທິ</p></div></div></div>)}
      </Section>}

      {tab === "TRIP" && <Section title="ຂໍໃຊ້ລົດອອກຕະຫຼາດ">
        {me.approvals.length > 0 && <ApprovalInbox approvals={me.approvals} idToken={idToken} onChanged={onChanged} />}
        <EmployeeTripForm idToken={idToken} onSaved={onChanged} />
        <ListEmpty when={me.trips.length === 0} text="ຍັງບໍ່ມີຄຳຮ້ອງຂໍໃຊ້ລົດ" />
        {me.trips.map((item) => <ListRow key={item.id} title={`${item.destination}${item.vehiclePlate ? ` · ${item.vehiclePlate}` : ""}`} subtitle={`${fmtTripRange(item.date, item.endDate)} · ຄັ້ງທີ ${item.tripNo}${item.departTime || item.returnTime ? ` · ${item.departTime ?? "—"}–${item.returnTime ?? "—"}` : ""}${item.status === "PENDING" && item.totalApprovalSteps > 0 ? ` · ຂັ້ນ ${item.approvalLevel + 1}/${item.totalApprovalSteps}${item.currentStepLabel ? ` (${item.currentStepLabel})` : ""}` : ""}`} status={item.status} />)}
      </Section>}

      {tab === "KB" && <KnowledgeTab idToken={idToken} onAcked={onChanged} />}

      {tab === "PROFILE" && <Section title="ຂໍ້ມູນຂອງຂ້ອຍ">
        <ProfileRow label="ລະຫັດ" value={me.code} /><ProfileRow label="ຊື່" value={`${me.profile.title ?? ""} ${me.name}`} /><ProfileRow label="ຕຳແໜ່ງ" value={me.profile.position} /><ProfileRow label="ຝ່າຍ" value={me.profile.division} /><ProfileRow label="ພະແນກ" value={me.profile.department} /><ProfileRow label="ໜ່ວຍງານ" value={me.profile.unit} /><ProfileRow label="ເບີໂທ" value={me.profile.mobile} /><ProfileRow label="ອີເມວ" value={me.profile.email} /><ProfileRow label="ວັນເລີ່ມວຽກ" value={me.profile.hireDate ? fmtDate(me.profile.hireDate) : null} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <QuickCard label="OT ຂອງຂ້ອຍ" value={String(me.overtime.length)} onClick={() => setTab("OT")} />
          <QuickCard label="ສະລິບເງິນເດືອນ" value={String(me.payslips.length)} onClick={() => setTab("PAY")} />
        </div>
        {onLogout && <button onClick={onLogout} className="mt-4 w-full rounded-xl border border-rose-200 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50">ອອກຈາກລະບົບ</button>}
      </Section>}
    </main>

    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-md grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-lg md:static md:mt-6 md:max-w-3xl md:rounded-2xl md:border md:shadow-sm">
      {([['HOME','ໜ້າຫຼັກ','⌂'],['LEAVE','ການລາ','▣'],['TRIP','Trip','⇄'],['KB','ຄວາມຮູ້','📖'],['PROFILE','ຂໍ້ມູນ','○']] as [AppTab,string,string][]).map(([key,label,icon]) => <button key={key} onClick={() => setTab(key)} className={`relative py-2 text-center ${tab === key ? "text-emerald-700" : "text-slate-400"}`}><span className="block text-lg leading-5">{icon}</span><span className="text-[10px]">{label}</span>{key === 'KB' && me.knowledge.pendingAck > 0 && <span className="absolute right-1/4 top-1 h-2 w-2 rounded-full bg-rose-500" />}</button>)}
    </nav>
  </div>;
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) { return <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">{title ? <h2 className="mb-4 font-semibold">{title}</h2> : null}{children}</section>; }
function QuickCard({ label, value, onClick }: { label: string; value: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300"><span className="block text-lg font-semibold text-emerald-700">{value}</span><span className="text-[11px] text-slate-500">{label}</span></button>; }
function ListEmpty({ when, text }: { when: boolean; text: string }) { return when ? <p className="py-8 text-center text-sm text-slate-400">{text}</p> : null; }
function ListRow({ title, subtitle, status }: { title: string; subtitle: string; status: string }) { const good = status === "APPROVED" || status === "PAID" || status === "CLOSED"; const bad = status === "REJECTED" || status === "CANCELLED"; return <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-medium">{title}</p><p className="text-xs text-slate-500">{subtitle}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${good ? "bg-emerald-100 text-emerald-700" : bad ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{STATUS_LABEL[status] ?? status}</span></div>; }
function ProfileRow({ label, value }: { label: string; value: string | null }) { return <div className="flex justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-medium">{value || "—"}</span></div>; }
function fmtDate(value: string) { return new Intl.DateTimeFormat("lo-LA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function fmtKip(value: number) { return `${new Intl.NumberFormat("lo-LA", { maximumFractionDigits: 0 }).format(value)} ₭`; }
function fmtTime(iso: string | null) { if (!iso) return "—"; return new Intl.DateTimeFormat("lo-LA", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Vientiane" }).format(new Date(iso)); }
function fmtWorked(min: number | null | undefined) { if (!min || min <= 0) return "—"; return `${Math.floor(min / 60)}ຊມ ${min % 60}ນທ`; }
function fmtTripRange(start: string, end: string) { if (start.slice(0, 10) === end.slice(0, 10)) return fmtDate(start); const days = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1; return `${fmtDate(start)}–${fmtDate(end)} · ${days} ມື້`; }

function EmployeeLeaveForm({ idToken, types, onSaved }: { idToken?: string; types: LinkedMe["leave"]["types"]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/employee-app/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, ...(idToken ? { idToken } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(employeeAppError(result.error));
      form.reset(); setOpen(false); setMessage(`ສົ່ງຄຳຂໍລາ ${result.days} ວັນແລ້ວ`); await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ສົ່ງຄຳຂໍບໍ່ໄດ້"); } finally { setBusy(false); }
  };
  return <div className="mb-4">
    <button onClick={() => setOpen(!open)} className="mb-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">{open ? "ປິດຟອມ" : "+ ສ້າງຄຳຂໍລາ"}</button>
    {message && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{message}</p>}
    {open && <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
      <select name="leaveTypeId" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">— ເລືອກປະເພດການລາ —</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}{type.requiresProof ? " (ຕ້ອງມີຫຼັກຖານ)" : ""}</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">ວັນເລີ່ມ<input name="startDate" type="date" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-slate-500">ວັນສິ້ນສຸດ<input name="endDate" type="date" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div>
      <input name="reason" maxLength={500} placeholder="ເຫດຜົນ" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <input name="proofUrl" placeholder="ລິ້ງຫຼັກຖານ (ຖ້າມີ)" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຂໍ"}</button>
    </form>}
  </div>;
}

function EmployeeOvertimeForm({ idToken, onSaved }: { idToken?: string; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/employee-app/overtime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, ...(idToken ? { idToken } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(employeeAppError(result.error));
      form.reset(); setOpen(false); setMessage(`ສົ່ງຄຳຂໍ OT ${result.hours} ຊມ · ${result.rate}× ແລ້ວ`); await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ສົ່ງຄຳຂໍບໍ່ໄດ້"); } finally { setBusy(false); }
  };
  return <div className="mb-4">
    <button onClick={() => setOpen(!open)} className="mb-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">{open ? "ປິດຟອມ" : "+ ສ້າງຄຳຂໍ OT"}</button>
    {message && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{message}</p>}
    {open && <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
      <input name="workDate" type="date" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">ເລີ່ມ<input name="startTime" type="time" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-slate-500">ສິ້ນສຸດ<input name="endTime" type="time" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div>
      <input name="reason" maxLength={500} placeholder="ເຫດຜົນ" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຂໍ OT"}</button>
    </form>}
  </div>;
}

function EmployeeTripForm({ idToken, onSaved }: { idToken?: string; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = event.currentTarget;
    const fd = new FormData(form);
    // datetime-local → ແຍກເປັນ ວັນ + ເວລາ ໃຫ້ API
    const [date, startTime] = String(fd.get("startAt") ?? "").split("T");
    const [endDate, endTime] = String(fd.get("endAt") ?? "").split("T");
    if (!date || !endDate || !startTime || !endTime) { setMessage("ກະລຸນາໃສ່ວັນ ແລະ ເວລາ"); setBusy(false); return; }
    const payload = {
      date, endDate,
      departTime: startTime.slice(0, 5),
      returnTime: endTime.slice(0, 5),
      tripNo: String(fd.get("tripNo") ?? "1"),
      destination: String(fd.get("destination") ?? ""),
      note: String(fd.get("note") ?? ""),
      ...(idToken ? { idToken } : {}),
    };
    try {
      const response = await fetch("/api/employee-app/trip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(employeeAppError(result.error));
      form.reset(); setOpen(false); setMessage("ສົ່ງຄຳຮ້ອງຂໍໃຊ້ລົດແລ້ວ — ລໍຖ້າຈັດລົດ + ອະນຸມັດ"); await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ສົ່ງຄຳຂໍບໍ່ໄດ້"); } finally { setBusy(false); }
  };
  return <div className="mb-4">
    <button onClick={() => setOpen(!open)} className="mb-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">{open ? "ປິດຟອມ" : "+ ຂໍໃຊ້ລົດອອກຕະຫຼາດ"}</button>
    {message && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{message}</p>}
    {open && <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">ວັນ-ເວລາເລີ່ມ<input name="startAt" type="datetime-local" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-slate-500">ວັນ-ເວລາສິ້ນສຸດ<input name="endAt" type="datetime-local" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div>
      <label className="block text-xs text-slate-500">ຄັ້ງທີ<input name="tripNo" type="number" min={1} max={20} defaultValue={1} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
      <input name="destination" maxLength={200} required placeholder="ຕະຫຼາດ / ເສັ້ນທາງ (ເຊັ່ນ ຕະຫຼາດເຊົ້າ)" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <input name="note" maxLength={500} placeholder="ໝາຍເຫດ (ຖ້າມີ)" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຮ້ອງ"}</button>
    </form>}
  </div>;
}

function ApprovalInbox({ approvals, idToken, onChanged }: { approvals: LinkedMe["approvals"]; idToken?: string; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const act = async (tripId: string, action: "APPROVE" | "REJECT") => {
    let reason: string | undefined;
    if (action === "REJECT") {
      const input = window.prompt("ເຫດຜົນທີ່ປະຕິເສດ:");
      if (input === null) return;
      reason = input;
    }
    setBusyId(tripId); setMessage(null);
    try {
      const response = await fetch("/api/employee-app/trip-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId, action, reason, ...(idToken ? { idToken } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(employeeAppError(result.error));
      setMessage(action === "APPROVE" ? "ອະນຸມັດແລ້ວ" : "ປະຕິເສດແລ້ວ"); await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ດຳເນີນການບໍ່ໄດ້"); } finally { setBusyId(null); }
  };
  return <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
    <p className="mb-2 text-sm font-semibold text-amber-800">🔔 ລໍຖ້າຂ້ອຍອະນຸມັດ ({approvals.length})</p>
    {message && <p className="mb-2 text-xs text-emerald-700">{message}</p>}
    <div className="space-y-2">
      {approvals.map((a) => <div key={a.id} className="rounded-lg bg-white p-3">
        <p className="text-sm font-medium">{a.destination}</p>
        <p className="text-xs text-slate-500">ໂດຍ {a.requester} · {fmtTripRange(a.date, a.endDate)} · ຄັ້ງທີ {a.tripNo}{a.departTime || a.returnTime ? ` · ${a.departTime ?? "—"}–${a.returnTime ?? "—"}` : ""}</p>
        {a.members.length > 0 && <p className="text-[11px] text-slate-400">ຄົນໄປ: {a.members.join(", ")}</p>}
        {a.note && <p className="text-[11px] text-slate-400">ໝາຍເຫດ: {a.note}</p>}
        <p className="mt-1 text-[11px] text-amber-700">ຂັ້ນ {a.stepIndex}/{a.totalSteps} · {a.stepLabel}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => act(a.id, "APPROVE")} disabled={busyId === a.id} className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === a.id ? "..." : "✓ ອະນຸມັດ"}</button>
          <button onClick={() => act(a.id, "REJECT")} disabled={busyId === a.id} className="rounded-lg border border-rose-300 px-4 py-2 text-xs font-medium text-rose-600 disabled:opacity-50">✗ ປະຕິເສດ</button>
        </div>
      </div>)}
    </div>
  </div>;
}

type KbListItem = { id: string; title: string; excerpt: string; category: string | null; tags: string[]; version: number; attachmentCount: number; updatedAt: string; ackPending: boolean };
type KbArticle = { id: string; title: string; summary: string | null; body: string; tags: string[]; version: number; category: string | null; publishedAt: string | null; updatedAt: string; requiresAck: boolean; needsAck: boolean; ackedVersion: number | null; canDownload: boolean; attachments: { id: string; name: string; size: string; url: string }[] };

/**
 * ຄັງຄວາມຮູ້ ໃນແອັບພະນັກງານ — ອ່ານ + ກົດຮັບຮູ້ ເທົ່ານັ້ນ.
 *
 * ດຶງລາຍການຕອນເປີດແທັບ (ບໍ່ຕິດມາກັບ /api/attendance/me ເພື່ອບໍ່ໃຫ້ payload ໜັກ)
 * ແລະ ດຶງເນື້ອໃນເຕັມສະເພາະຕອນເປີດບົດ. ໃຊ້ renderer ອັນດຽວກັນກັບເວັບ (markdown.ts)
 * ຈຶ່ງໜ້າຕາຂອງເນື້ອໃນຄືກັນທັງສອງບ່ອນ.
 */
function KnowledgeTab({ idToken, onAcked }: { idToken?: string; onAcked: () => Promise<void> }) {
  const [items, setItems] = useState<KbListItem[] | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; count: number }[]>([]);
  const [category, setCategory] = useState("");
  const [term, setTerm] = useState("");
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const response = await fetch("/api/employee-app/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...(idToken ? { idToken } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(employeeAppError(result.error));
      return result;
    },
    [idToken],
  );

  // ⚠ ຢ່າ setState ກ່ອນ await ໃນນີ້ — ຖືກເອີ້ນຈາກ useEffect ແລະ eslint
  // (react-hooks/set-state-in-effect) ຈະຟ້ອງເລື່ອງ cascading render
  const load = useCallback(
    async (q: string, categoryId: string) => {
      try {
        const result = await post({ action: "list", q, categoryId });
        setItems(result.articles as KbListItem[]);
        setCategories(result.categories);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ໂຫຼດບໍ່ໄດ້");
        setItems([]);
      }
    },
    [post],
  );

  useEffect(() => {
    // ຮູບແບບດຽວກັນກັບ employee/page.tsx — ເອີ້ນຜ່ານ async IIFE
    (async () => {
      await load("", "");
    })();
  }, [load]);

  const openArticle = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      setArticle((await post({ action: "read", id })) as KbArticle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ເປີດບົດບໍ່ໄດ້");
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async () => {
    if (!article) return;
    setBusy(true);
    setError(null);
    try {
      await post({ action: "ack", id: article.id });
      setArticle({ ...article, needsAck: false, ackedVersion: article.version });
      await load(term, category);
      await onAcked(); // ອັບເດດປ້າຍເຕືອນຢູ່ໜ້າຫຼັກ
    } catch (e) {
      setError(e instanceof Error ? e.message : "ບັນທຶກບໍ່ໄດ້");
    } finally {
      setBusy(false);
    }
  };

  if (article) {
    return (
      <Section>
        <button onClick={() => setArticle(null)} className="mb-3 text-sm text-emerald-700">← ກັບໄປລາຍການ</button>
        <h2 className="text-lg font-semibold">{article.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {article.category ? `${article.category} · ` : ""}ຮຸ່ນ {article.version} · ອັບເດດ {fmtDate(article.publishedAt ?? article.updatedAt)}
        </p>
        {article.tags.length > 0 && <p className="mt-1 text-xs text-slate-400">{article.tags.map((t) => `#${t}`).join(" ")}</p>}

        {error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

        {article.needsAck && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">ບົດນີ້ຕ້ອງກົດຮັບຮູ້ຫຼັງອ່ານຈົບ</p>
            {article.ackedVersion !== null && <p className="mt-1 text-xs text-amber-800">ທ່ານເຄີຍຮັບຮູ້ຮຸ່ນ {article.ackedVersion} — ບົດຖືກປັບປຸງເປັນຮຸ່ນ {article.version}</p>}
            <button onClick={acknowledge} disabled={busy} className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "ກຳລັງບັນທຶກ..." : `ຮັບຮູ້ຮຸ່ນ ${article.version}`}
            </button>
          </div>
        )}
        {article.requiresAck && !article.needsAck && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">✓ ທ່ານຮັບຮູ້ຮຸ່ນ {article.version} ແລ້ວ</p>
        )}

        <div className="kb-prose mt-4 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }} />

        {article.attachments.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold">ໄຟລ໌ແນບ</p>
            {article.canDownload ? (
              article.attachments.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="mb-2 block rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="text-emerald-700">{f.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{f.size}</span>
                </a>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                ມີ {article.attachments.length} ໄຟລ໌ແນບ — ເປີດຜ່ານເວັບ HRM ເພື່ອດາວໂຫຼດ
              </p>
            )}
          </div>
        )}
      </Section>
    );
  }

  return (
    <Section title="ຄັງຄວາມຮູ້">
      <form
        onSubmit={(e) => { e.preventDefault(); void load(term, category); }}
        className="mb-3 flex gap-2"
      >
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ຄົ້ນຫາຫົວຂໍ້ ຫຼື ເນື້ອໃນ…" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">ຄົ້ນ</button>
      </form>

      {categories.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {[{ id: "", name: "ທັງໝົດ", count: 0 }, ...categories].map((c) => (
            <button
              key={c.id || "all"}
              onClick={() => { setCategory(c.id); void load(term, c.id); }}
              className={`rounded-full px-3 py-1 text-xs ${category === c.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {c.name}{c.id ? ` (${c.count})` : ""}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
      {items === null && <p className="py-8 text-center text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>}
      <ListEmpty when={items !== null && items.length === 0} text={term || category ? "ບໍ່ພົບບົດທີ່ກົງກັບເງື່ອນໄຂ" : "ຍັງບໍ່ມີບົດໃນຄັງ"} />

      {(items ?? []).map((a) => (
        <button key={a.id} onClick={() => openArticle(a.id)} className="mb-2 block w-full rounded-xl border border-slate-200 p-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{a.title}</p>
            {a.ackPending && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-700">ຕ້ອງຮັບຮູ້</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{a.excerpt}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {a.category ? `${a.category} · ` : ""}ຮຸ່ນ {a.version}{a.attachmentCount > 0 ? ` · ໄຟລ໌ ${a.attachmentCount}` : ""} · {fmtDate(a.updatedAt)}
          </p>
        </button>
      ))}
    </Section>
  );
}

function employeeAppError(code: string | undefined): string {
  const messages: Record<string, string> = { invalid_token: "ເຊສຊັນໝົດອາຍຸ — ເຂົ້າສູ່ລະບົບໃໝ່", employee_not_linked: "ບັນຊີນີ້ຍັງບໍ່ໄດ້ຜູກກັບພະນັກງານ", invalid_data: "ກະລຸນາກວດຂໍ້ມູນ", invalid_date_range: "ຊ່ວງວັນທີບໍ່ຖືກຕ້ອງ", invalid_time_range: "ຊ່ວງເວລາບໍ່ຖືກຕ້ອງ", proof_required: "ປະເພດການລານີ້ຕ້ອງມີລິ້ງຫຼັກຖານ", leave_overlap: "ມີຄຳຂໍລາທັບຊ້ອນຊ່ວງນີ້ແລ້ວ", no_working_day: "ຊ່ວງນີ້ບໍ່ມີວັນເຮັດວຽກ", overtime_duplicate: "ມີຄຳຂໍ OT ຊ່ວງນີ້ແລ້ວ", trip_duplicate: "ມີຄຳຮ້ອງຂໍໃຊ້ລົດ ວັນ/ຄັ້ງນີ້ແລ້ວ" };
  return messages[code ?? ""] ?? "ສົ່ງຄຳຂໍບໍ່ໄດ້";
}

export function clockError(code: string | undefined): string {
  switch (code) {
    case "already_checked_in": return "ທ່ານລົງເວລາເຂົ້າແລ້ວ";
    case "already_checked_out": return "ທ່ານລົງເວລາອອກແລ້ວ";
    case "not_checked_in": return "ຕ້ອງລົງເວລາເຂົ້າກ່ອນ";
    case "not_scheduled_workday": return "ມື້ນີ້ບໍ່ແມ່ນວັນເຮັດວຽກຕາມຕາຕະລາງ ຫຼືເປັນວັນພັກ/ວັນລາ";
    case "location_required": return "ຕ້ອງເປີດ GPS ແລະອະນຸຍາດສະຖານທີ່ກ່ອນລົງເວລາ";
    case "outside_work_location": return "ທ່ານຢູ່ນອກພື້ນທີ່ທີ່ອະນຸຍາດໃຫ້ລົງເວລາ";
    case "location_not_configured": return "ຜູ້ດູແລຍັງຕັ້ງພິກັດບໍ່ຄົບ";
    case "invalid_token": return "ເຊສຊັນໝົດອາຍຸ — ເປີດ/ເຂົ້າໃໝ່";
    default: return "ບັນທຶກບໍ່ໄດ້ — ລອງໃໝ່";
  }
}
