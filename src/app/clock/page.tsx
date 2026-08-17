"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

// LIFF SDK ໂຫຼດຈາກ CDN → window.liff (ບໍ່ຜ່ານ bundler)
type Liff = {
  init: (c: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
};
declare global {
  interface Window {
    liff?: Liff;
  }
}

const LIFF_SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

type Today = {
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  workedMinutes: number | null;
} | null;

type Me =
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
      today: Today;
      leave: {
        types: { id: string; name: string; entitled: number; used: number; carriedOver: number; remaining: number; requiresProof: boolean }[];
        requests: { id: string; type: string; startDate: string; endDate: string; days: number; status: string; reason: string | null; rejectReason: string | null }[];
      };
      overtime: { id: string; workDate: string; startTime: string; endTime: string; hours: number; rate: number; status: string; reason: string | null; rejectReason: string | null }[];
      payslips: { id: string; year: number; month: number; status: string; grossPay: number; totalDeduction: number; netPay: number }[];
      trips: { id: string; date: string; endDate: string; tripNo: number; destination: string; departTime: string | null; returnTime: string | null; status: string; vehiclePlate: string | null; rejectReason: string | null; tripType: string; workflowStatus: string; salesTarget: number; customers: { id: string; sequence: number; customerName: string; address: string | null; status: string }[]; products: { productCode: string; productName: string; unit: string | null; loadedQty: number; soldQty: number }[] }[];
    }
  | { linked: false; lineName: string | null };

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("ໂຫຼດ LIFF SDK ບໍ່ໄດ້"));
    document.head.appendChild(s);
  });
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("lo-LA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Vientiane",
  }).format(new Date(iso));
}

export default function ClockPage() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [needsLineLogin, setNeedsLineLogin] = useState(false);

  const refresh = useCallback(async (token: string) => {
    const res = await fetch("/api/attendance/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!res.ok) throw new Error("ດຶງຂໍ້ມູນບໍ່ໄດ້ — ລອງໃໝ່");
    setMe((await res.json()) as Me);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // ໂໝດທົດລອງ (dev): /clock?emp=CODE → ຂ້າມ LINE, ໃຊ້ dev token ເບິ່ງແອັບພະນັກງານ
        if (process.env.NODE_ENV === "development") {
          const devEmp = new URLSearchParams(window.location.search).get("emp");
          if (devEmp) {
            const token = `dev:${devEmp}`;
            setIdToken(token);
            await refresh(token);
            return;
          }
        }
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ LIFF (NEXT_PUBLIC_LIFF_ID)");
        await loadScript(LIFF_SDK);
        const liff = window.liff!;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          setNeedsLineLogin(true);
          return;
        }
        const token = liff.getIDToken();
        if (!token) throw new Error("ບໍ່ໄດ້ຮັບ ID token ຈາກ LINE");
        setIdToken(token);
        await refresh(token);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ເກີດຂໍ້ຜິດພາດ");
      } finally {
        setBooting(false);
      }
    })();
  }, [refresh]);

  const clock = useCallback(
    async (action: "IN" | "OUT") => {
      if (!idToken) return;
      setBusy(true);
      setError(null);
      try {
        const coords = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
          if (!navigator.geolocation) return resolve({});
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve({}),
            { timeout: 5000 },
          );
        });
        const res = await fetch("/api/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, action, ...coords }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(clockError(data.error));
        await refresh(idToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ບັນທຶກບໍ່ໄດ້");
      } finally {
        setBusy(false);
      }
    },
    [idToken, refresh],
  );

  return (
    <div className={me?.linked ? "mx-auto min-h-screen max-w-md bg-slate-50" : "mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6"}>
      {me?.linked !== true && <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
          OD
        </div>
        <h1 className="text-xl font-semibold">ODIEN Employee App</h1>
        <p className="mt-1 text-sm text-slate-500">ລະບົບສຳລັບພະນັກງານ</p>
      </div>}

      {booting && <p className="text-center text-sm text-slate-500">ກຳລັງໂຫຼດ...</p>}

      {!booting && needsLineLogin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="font-semibold">ເຂົ້າສູ່ລະບົບພະນັກງານ</h2>
          <p className="mb-5 mt-2 text-sm text-slate-500">ໃຊ້ບັນຊີ LINE ເພື່ອຢືນຢັນຕົວຕົນ</p>
          <button onClick={() => window.liff?.login({ redirectUri: window.location.href })} className="w-full rounded-xl bg-[#06C755] py-3.5 font-semibold text-white transition active:scale-95">
            ເຂົ້າລະບົບດ້ວຍ LINE
          </button>
          <p className="mt-4 text-xs leading-5 text-slate-400">ລະບົບຈະໃຊ້ LINE ID ເພື່ອເປີດສະເພາະຂໍ້ມູນຂອງທ່ານ</p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
          {error}
        </p>
      )}

      {me?.linked === false && (
        <LinkForm
          idToken={idToken}
          lineName={me.lineName}
          onLinked={() => idToken && refresh(idToken)}
          setError={setError}
        />
      )}

      {me?.linked === true && (
        <EmployeeApp me={me} idToken={idToken!} busy={busy} onClock={clock} onChanged={() => refresh(idToken!)} />
      )}
    </div>
  );
}

type LinkedMe = Extract<Me, { linked: true }>;
type AppTab = "HOME" | "LEAVE" | "OT" | "PAY" | "TRIP" | "PROFILE";

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
  IN_PROGRESS: "ກຳລັງຂາຍ",
  RETURNED: "ກັບແລ້ວ",
};

const MONTH_LABEL = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];

function EmployeeApp({ me, idToken, busy, onClock, onChanged }: { me: LinkedMe; idToken: string; busy: boolean; onClock: (action: "IN" | "OUT") => void; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<AppTab>("HOME");
  return <div className="min-h-screen pb-20">
    <header className="bg-gradient-to-br from-emerald-700 to-emerald-500 px-5 pb-8 pt-5 text-white">
      <div className="flex items-center gap-3">
        {me.profile.photoUrl ? <Image src={me.profile.photoUrl} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-full border-2 border-white/70 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 font-bold">OD</div>}
        <div className="min-w-0">
          <p className="text-xs text-emerald-100">ສະບາຍດີ</p>
          <h1 className="truncate text-lg font-semibold">{me.profile.title ?? ""} {me.name}</h1>
          <p className="text-xs text-emerald-100">{me.code} · {me.profile.position ?? "ພະນັກງານ"}</p>
        </div>
      </div>
    </header>

    <main className="-mt-4 space-y-4 px-4">
      {tab === "HOME" && <>
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
        <section className="grid grid-cols-2 gap-3">
          <QuickCard label="ວັນລາເຫຼືອ" value={String(Math.max(0, me.leave.types.reduce((sum, item) => sum + item.remaining, 0)))} onClick={() => setTab("LEAVE")} />
          <QuickCard label="OT ຂອງຂ້ອຍ" value={String(me.overtime.length)} onClick={() => setTab("OT")} />
          <QuickCard label="ອອກຕະຫຼາດ / Trip" value={String(me.trips.length)} onClick={() => setTab("TRIP")} />
          <QuickCard label="ສະລິບ" value={String(me.payslips.length)} onClick={() => setTab("PAY")} />
        </section>
      </>}

      {tab === "LEAVE" && <Section title="ການລາຂອງຂ້ອຍ">
        <EmployeeLeaveForm idToken={idToken} types={me.leave.types} onSaved={onChanged} />
        <div className="grid grid-cols-2 gap-3">{me.leave.types.map((type) => <div key={type.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{type.name}</p><p className="mt-1 text-xl font-semibold">{type.remaining} <span className="text-xs font-normal">ວັນ</span></p><p className="text-[11px] text-slate-400">ໃຊ້ແລ້ວ {type.used}</p></div>)}</div>
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
        <EmployeeTripForm idToken={idToken} onSaved={onChanged} />
        <ListEmpty when={me.trips.length === 0} text="ຍັງບໍ່ມີຄຳຮ້ອງຂໍໃຊ້ລົດ" />
        {me.trips.map((item) => <div key={item.id} className="mb-3 rounded-xl border border-slate-200 p-3"><ListRow title={`${item.destination}${item.vehiclePlate ? ` · ${item.vehiclePlate}` : ""}`} subtitle={`${fmtTripRange(item.date, item.endDate)} · ຄັ້ງທີ ${item.tripNo}${item.departTime || item.returnTime ? ` · ${item.departTime ?? "—"}–${item.returnTime ?? "—"}` : ""}`} status={item.status} />{item.tripType === "SALE" && item.status !== "PENDING" && <div className="mt-2 border-t border-slate-100 pt-2"><p className="text-xs font-medium text-slate-600">ລູກຄ້າ {item.customers.length} · ສິນຄ້າ {item.products.length} · ເປົ້າໝາຍ {fmtKip(item.salesTarget)}</p>{item.customers.map((customer) => <p key={customer.id} className="mt-1 text-xs text-slate-500">{customer.sequence}. {customer.customerName}{customer.address ? ` · ${customer.address}` : ""}</p>)}</div>}</div>)}
      </Section>}

      {tab === "PROFILE" && <Section title="ຂໍ້ມູນຂອງຂ້ອຍ">
        <ProfileRow label="ລະຫັດ" value={me.code} /><ProfileRow label="ຊື່" value={`${me.profile.title ?? ""} ${me.name}`} /><ProfileRow label="ຕຳແໜ່ງ" value={me.profile.position} /><ProfileRow label="ຝ່າຍ" value={me.profile.division} /><ProfileRow label="ພະແນກ" value={me.profile.department} /><ProfileRow label="ໜ່ວຍງານ" value={me.profile.unit} /><ProfileRow label="ເບີໂທ" value={me.profile.mobile} /><ProfileRow label="ອີເມວ" value={me.profile.email} /><ProfileRow label="ວັນເລີ່ມວຽກ" value={me.profile.hireDate ? fmtDate(me.profile.hireDate) : null} />
      </Section>}
    </main>

    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-md grid-cols-6 border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-lg">
      {([['HOME','ໜ້າຫຼັກ','⌂'],['LEAVE','ການລາ','▣'],['OT','OT','◷'],['TRIP','Trip','⇄'],['PAY','ເງິນເດືອນ','₭'],['PROFILE','ຂໍ້ມູນ','○']] as [AppTab,string,string][]).map(([key,label,icon]) => <button key={key} onClick={() => setTab(key)} className={`py-2 text-center ${tab === key ? "text-emerald-700" : "text-slate-400"}`}><span className="block text-lg leading-5">{icon}</span><span className="text-[10px]">{label}</span></button>)}
    </nav>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><h2 className="mb-4 font-semibold">{title}</h2>{children}</section>; }
function QuickCard({ label, value, onClick }: { label: string; value: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200"><span className="block text-lg font-semibold text-emerald-700">{value}</span><span className="text-[11px] text-slate-500">{label}</span></button>; }
function ListEmpty({ when, text }: { when: boolean; text: string }) { return when ? <p className="py-8 text-center text-sm text-slate-400">{text}</p> : null; }
function ListRow({ title, subtitle, status }: { title: string; subtitle: string; status: string }) { const good = status === "APPROVED" || status === "PAID" || status === "CLOSED"; const bad = status === "REJECTED" || status === "CANCELLED"; return <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-medium">{title}</p><p className="text-xs text-slate-500">{subtitle}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${good ? "bg-emerald-100 text-emerald-700" : bad ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{STATUS_LABEL[status] ?? status}</span></div>; }
function ProfileRow({ label, value }: { label: string; value: string | null }) { return <div className="flex justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-medium">{value || "—"}</span></div>; }
function fmtDate(value: string) { return new Intl.DateTimeFormat("lo-LA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function fmtKip(value: number) { return `${new Intl.NumberFormat("lo-LA", { maximumFractionDigits: 0 }).format(value)} ₭`; }

function EmployeeLeaveForm({ idToken, types, onSaved }: { idToken: string; types: LinkedMe["leave"]["types"]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/employee-app/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, idToken }) });
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

function EmployeeOvertimeForm({ idToken, onSaved }: { idToken: string; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/employee-app/overtime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, idToken }) });
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

function EmployeeTripForm({ idToken, onSaved }: { idToken: string; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/employee-app/trip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, idToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(employeeAppError(result.error));
      form.reset(); setOpen(false); setMessage("ສົ່ງຄຳຮ້ອງຂໍໃຊ້ລົດແລ້ວ — ລໍຖ້າຈັດລົດ + ອະນຸມັດ"); await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ສົ່ງຄຳຂໍບໍ່ໄດ້"); } finally { setBusy(false); }
  };
  return <div className="mb-4">
    <button onClick={() => setOpen(!open)} className="mb-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">{open ? "ປິດຟອມ" : "+ ຂໍໃຊ້ລົດອອກຕະຫຼາດ"}</button>
    {message && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{message}</p>}
    {open && <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">ວັນເລີ່ມ<input name="date" type="date" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-slate-500">ວັນສິ້ນສຸດ<input name="endDate" type="date" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div>
      <label className="block text-xs text-slate-500">ຄັ້ງທີ<input name="tripNo" type="number" min={1} max={20} defaultValue={1} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
      <input name="destination" maxLength={200} required placeholder="ຕະຫຼາດ / ເສັ້ນທາງ (ເຊັ່ນ ຕະຫຼາດເຊົ້າ)" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">ເວລາເລີ່ມ<input name="departTime" type="time" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-slate-500">ເວລາສິ້ນສຸດ<input name="returnTime" type="time" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div>
      <input name="note" maxLength={500} placeholder="ໝາຍເຫດ (ຖ້າມີ)" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຮ້ອງ"}</button>
    </form>}
  </div>;
}

function employeeAppError(code: string | undefined): string {
  const messages: Record<string, string> = { invalid_token: "ເຊສຊັນ LINE ໝົດອາຍຸ", employee_not_linked: "ບັນຊີ LINE ຍັງບໍ່ໄດ້ຜູກກັບພະນັກງານ", invalid_data: "ກະລຸນາກວດຂໍ້ມູນ", invalid_date_range: "ຊ່ວງວັນທີບໍ່ຖືກຕ້ອງ", invalid_time_range: "ຊ່ວງເວລາບໍ່ຖືກຕ້ອງ", proof_required: "ປະເພດການລານີ້ຕ້ອງມີລິ້ງຫຼັກຖານ", leave_overlap: "ມີຄຳຂໍລາທັບຊ້ອນຊ່ວງນີ້ແລ້ວ", no_working_day: "ຊ່ວງນີ້ບໍ່ມີວັນເຮັດວຽກ", overtime_duplicate: "ມີຄຳຂໍ OT ຊ່ວງນີ້ແລ້ວ", trip_duplicate: "ມີຄຳຮ້ອງຂໍໃຊ້ລົດ ວັນ/ຄັ້ງນີ້ແລ້ວ" };
  return messages[code ?? ""] ?? "ສົ່ງຄຳຂໍບໍ່ໄດ້";
}

function fmtWorked(min: number | null | undefined) {
  if (!min || min <= 0) return "—";
  return `${Math.floor(min / 60)}ຊມ ${min % 60}ນທ`;
}

function fmtTripRange(start: string, end: string) {
  const startLabel = fmtDate(start);
  if (start.slice(0, 10) === end.slice(0, 10)) return startLabel;
  const days = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
  return `${startLabel}–${fmtDate(end)} · ${days} ມື້`;
}

function clockError(code: string | undefined): string {
  switch (code) {
    case "already_checked_in":
      return "ທ່ານລົງເວລາເຂົ້າແລ້ວ";
    case "already_checked_out":
      return "ທ່ານລົງເວລາອອກແລ້ວ";
    case "not_checked_in":
      return "ຕ້ອງລົງເວລາເຂົ້າກ່ອນ";
    case "not_scheduled_workday":
      return "ມື້ນີ້ບໍ່ແມ່ນວັນເຮັດວຽກຕາມຕາຕະລາງ ຫຼືເປັນວັນພັກ/ວັນລາ";
    case "location_required":
      return "ຕ້ອງເປີດ GPS ແລະອະນຸຍາດສະຖານທີ່ກ່ອນລົງເວລາ";
    case "outside_work_location":
      return "ທ່ານຢູ່ນອກພື້ນທີ່ທີ່ອະນຸຍາດໃຫ້ລົງເວລາ";
    case "location_not_configured":
      return "ຜູ້ດູແລຍັງຕັ້ງພິກັດບໍ່ຄົບ";
    case "invalid_token":
      return "ເຊສຊັນ LINE ໝົດອາຍຸ — ເປີດໃໝ່";
    default:
      return "ບັນທຶກບໍ່ໄດ້ — ລອງໃໝ່";
  }
}

function LinkForm({
  idToken,
  lineName,
  onLinked,
  setError,
}: {
  idToken: string | null;
  lineName: string | null;
  onLinked: () => void;
  setError: (s: string | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(linkError(data.error));
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ຜູກບັນຊີບໍ່ໄດ້");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="mb-1 text-center font-medium">ຢືນຢັນບັນຊີພະນັກງານ</p>
      <p className="mb-4 text-center text-xs text-slate-500">
        {lineName ? `LINE: ${lineName} · ` : ""}ເຮັດພຽງຄັ້ງທຳອິດເທົ່ານັ້ນ
      </p>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="ລະຫັດພະນັກງານ"
        autoComplete="username"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="ລະຫັດຜ່ານ"
        autoComplete="current-password"
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
      />
      <button
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "ກຳລັງຜູກ..." : "ຜູກບັນຊີ"}
      </button>
    </form>
  );
}

function linkError(code: string | undefined): string {
  const messages: Record<string, string> = {
    invalid_credentials: "ລະຫັດພະນັກງານ ຫຼືລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ",
    inactive_employee: "ບັນຊີພະນັກງານນີ້ຖືກປິດໃຊ້ງານ",
    employee_already_linked: "ພະນັກງານນີ້ຜູກກັບ LINE ອື່ນແລ້ວ",
    line_already_linked: "LINE ນີ້ຜູກກັບພະນັກງານອື່ນແລ້ວ",
    invalid_token: "ເຊສຊັນ LINE ໝົດອາຍຸ—ກະລຸນາເປີດໃໝ່",
  };
  return messages[code ?? ""] ?? "ຜູກບັນຊີບໍ່ໄດ້";
}
