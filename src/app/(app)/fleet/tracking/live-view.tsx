"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrackMap, type MapMarker } from "@/components/track-map";
import { lookupAddress, refreshPositions } from "./actions";
import type { VehiclePosition } from "@/lib/fleet-live";
import { extrapolateGpsPosition } from "@/lib/gps-motion";

type Kind = "moving" | "idle" | "off" | "nosignal";

/** ບໍ່ໄດ້ຍິນຈາກອຸປະກອນເກີນນີ້ = ຖືວ່າຂາດສັນຍານ (ນາທີ) */
const STALE_MIN = 30;
/**
 * ດຶງພິກັດຈິງຈາກ Lao GPS ທຸກ 20 ວິນາທີຕາມຮອບຂອງອຸປະກອນ. ລະຫວ່າງຮອບ
 * UI ຈະຄາດຄະເນຕຳແໜ່ງຕາມຄວາມໄວ + ທິດທາງທຸກວິນາທີ.
 */
const POLL_MS = 20_000;
const MOTION_MS = 1000;
/** ຍອມໃຫ້ເກີນຮອບ refresh ໄດ້ເລັກນ້ອຍ ເພື່ອຊົດເຊີຍ network/API latency */
const MAX_EXTRAPOLATION_SECONDS = POLL_MS / 1000 + 5;

function minutesAgo(recordedAt: string | null): number | null {
  if (!recordedAt) return null;
  // ຮັບທັງ ISO ("...Z") ຈາກ API ແລະ "YYYY-MM-DD HH:MM:SS" ຈາກ TMS
  const t = Date.parse(recordedAt.includes("T") ? recordedAt : recordedAt.replace(" ", "T"));
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function recordedTimeMs(recordedAt: string | null): number | null {
  if (!recordedAt) return null;
  const t = Date.parse(recordedAt.includes("T") ? recordedAt : recordedAt.replace(" ", "T"));
  return Number.isNaN(t) ? null : t;
}

function classify(p: VehiclePosition): Kind {
  if (p.lat == null || p.lng == null) return "nosignal";
  const mins = minutesAgo(p.recordedAt);
  if (mins == null || mins > STALE_MIN) return "nosignal";
  if ((p.speed ?? 0) > 3) return "moving";
  if (p.engineState === "1" || p.engineState?.toLowerCase() === "on") return "idle";
  return "off";
}

const KIND: Record<Kind, { label: string; dot: string; chip: string; color: string }> = {
  moving: { label: "ກຳລັງແລ່ນ", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800", color: "#10b981" },
  idle: { label: "ຕິດເຄື່ອງຈອດ", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800", color: "#f59e0b" },
  off: { label: "ດັບເຄື່ອງ", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700", color: "#94a3b8" },
  nosignal: { label: "ບໍ່ມີສັນຍານ", dot: "bg-rose-400", chip: "bg-rose-100 text-rose-700", color: "#fb7185" },
};
const ORDER: Kind[] = ["moving", "idle", "off", "nosignal"];

/** ວັນນີ້ຕາມເວລາລາວ — ໃຊ້ເປັນຊ່ວງວັນຂອງລິ້ງໄປໜ້າປະຫວັດເສັ້ນທາງ */
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Vientiane" });

function ago(recordedAt: string | null): string {
  const m = minutesAgo(recordedAt);
  if (m == null) return "—";
  if (m < 1) return "ຫາກໍ່ນີ້";
  if (m < 60) return `${m} ນທ`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ຊມ`;
  return `${Math.floor(h / 24)} ມື້`;
}

/** ຕັດຄຳນຳໜ້າພາສາໄທຂອງ provider ("จ.…เขต…") ໃຫ້ອ່ານງ່າຍ */
function cleanAddress(a: string | null): string | null {
  if (!a) return null;
  return a.replace(/^จ\./, "").replace(/\s*เขต\s*/, " · ").trim() || null;
}

function directionLabel(heading: number | null): string {
  if (heading == null || !Number.isFinite(heading)) return "—";
  const directions = ["ເໜືອ", "ອອກສຽງເໜືອ", "ຕາເວັນອອກ", "ອອກສຽງໃຕ້", "ໃຕ້", "ຕົກສຽງໃຕ້", "ຕາເວັນຕົກ", "ຕົກສຽງເໜືອ"];
  const normalized = ((heading % 360) + 360) % 360;
  return `${directions[Math.round(normalized / 45) % 8]} · ${Math.round(normalized)}°`;
}

function engineLabel(state: string | null): string {
  if (state == null) return "—";
  return state === "1" || state.toLowerCase() === "on" ? "ເປີດ" : "ປິດ";
}

function fuelLabel(litre: number | null, percent: number | null): string {
  const parts = [];
  if (litre != null) parts.push(`${litre.toLocaleString("en-US", { maximumFractionDigits: 1 })} L`);
  if (percent != null) parts.push(`${percent.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`);
  return parts.join(" · ") || "—";
}

const SOURCE_LABEL = {
  live: "ສົດ",
  cached: "ສຳຮອງ",
  tms: "TMS",
} as const;

export default function LiveView({ initial }: { initial: VehiclePosition[] }) {
  const [positions, setPositions] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Kind | null>(null);
  const [search, setSearch] = useState("");
  /** null = ທຸກພະແນກ · "__none" = ລົດທີ່ຍັງບໍ່ໄດ້ລະບຸພະແນກ */
  const [dept, setDept] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [motionNow, setMotionNow] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const next = await refreshPositions();
      if (mounted.current) {
        const now = Date.now();
        setPositions(next);
        setMotionNow(now);
        setUpdatedAt(new Date().toLocaleTimeString("lo-LA"));
      }
    } catch {
      /* ຂ້າມຮອບທີ່ລົ້ມ — ຮອບຕໍ່ໄປຈະລອງໃໝ່ເອງ */
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const startTimer = window.setTimeout(() => {
      setMotionNow(Date.now());
    }, 0);
    const refreshTimer = window.setInterval(() => void load(), POLL_MS);
    const motionTimer = window.setInterval(() => setMotionNow(Date.now()), MOTION_MS);
    return () => {
      mounted.current = false;
      window.clearTimeout(startTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(motionTimer);
    };
  }, [load]);

  // ທີ່ຢູ່ຈິງຂອງຄັນທີ່ເລືອກ — ຖາມ geocoder ເທື່ອດຽວຕໍ່ຕຳແໜ່ງ (ມີ cache ຝັ່ງເຊີບເວີ)
  const [addr, setAddr] = useState<{ key: string; text: string | null } | null>(null);
  useEffect(() => {
    const p = positions.find((x) => x.id === selected);
    if (!p?.lat || !p.lng) return;
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (addr?.key === key) return;
    let alive = true;
    lookupAddress(p.lat, p.lng).then((text) => alive && setAddr({ key, text }));
    return () => {
      alive = false;
    };
  }, [selected, positions, addr?.key]);

  const kinds = useMemo(() => new Map(positions.map((p) => [p.id, classify(p)])), [positions]);

  const summary = useMemo(() => {
    const s: Record<Kind, number> = { moving: 0, idle: 0, off: 0, nosignal: 0 };
    for (const k of kinds.values()) s[k] += 1;
    return s;
  }, [kinds]);

  const NO_DEPT = "__none";
  const deptLabel = useCallback((p: VehiclePosition) => p.department?.trim() || NO_DEPT, []);
  /** ພະແນກທັງໝົດ (ຮຽງຕາມຈຳນວນລົດ) — ໃຊ້ເປັນຕົວເລືອກ ແລະ ຫົວກຸ່ມ */
  const depts = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of positions) count.set(deptLabel(p), (count.get(deptLabel(p)) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [positions, deptLabel]);

  const deptOrder = useMemo(() => depts.map(([label]) => label), [depts]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return positions
      .filter((p) => (filter ? kinds.get(p.id) === filter : true))
      .filter((p) => (dept ? deptLabel(p) === dept : true))
      .filter((p) =>
        q ? `${p.plateNo ?? ""} ${p.name ?? ""} ${p.driverName ?? ""} ${p.department ?? ""}`.toLowerCase().includes(q) : true,
      )
      .sort(
        (a, b) =>
          // ບໍ່ໄດ້ເລືອກພະແນກ → ຈັດເປັນກຸ່ມຕາມພະແນກ (ພະແນກລົດຫຼາຍກ່ອນ) ແລ້ວຈຶ່ງຮຽງຕາມສະຖານະ
          (dept ? 0 : deptOrder.indexOf(deptLabel(a)) - deptOrder.indexOf(deptLabel(b))) ||
          ORDER.indexOf(kinds.get(a.id)!) - ORDER.indexOf(kinds.get(b.id)!),
      );
  }, [positions, filter, dept, search, kinds, deptLabel, deptOrder]);

  // ຄຳນວນຈາກເວລາບັນທຶກຂອງອຸປະກອນ (ບໍ່ແມ່ນເວລາຮັບ response)
  // ຈຶ່ງຊົດເຊີຍ latency ໄດ້: ໄລຍະທາງ = ຄວາມໄວ × ເວລາ.
  const animatedById = useMemo(() => {
    return new Map(
      positions.map((p) => {
        const recordedAtMs = recordedTimeMs(p.recordedAt);
        const ageSeconds =
          recordedAtMs == null ? null : Math.max(0, (motionNow - recordedAtMs) / 1000);
        const elapsedSeconds = Math.min(MAX_EXTRAPOLATION_SECONDS, ageSeconds ?? 0);
        if (
          motionNow <= 0 ||
          elapsedSeconds <= 0 ||
          p.lat == null ||
          p.lng == null ||
          p.heading == null ||
          (p.speed ?? 0) <= 3 ||
          ageSeconds == null ||
          ageSeconds > MAX_EXTRAPOLATION_SECONDS
        ) {
          return [p.id, p] as const;
        }
        const projected = extrapolateGpsPosition({
          lat: p.lat,
          lng: p.lng,
          speedKmh: p.speed!,
          headingDegrees: p.heading,
          elapsedSeconds,
        });
        return [p.id, { ...p, ...projected }] as const;
      }),
    );
  }, [positions, motionNow]);

  // ໝຸດເທິງແຜນທີ່ = ລົດທີ່ຢູ່ໃນລາຍການທີ່ກັ່ນຕອງແລ້ວ ແລະ ມີພິກັດ
  const markers: MapMarker[] = list
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      const animated = animatedById.get(p.id) ?? p;
      return {
        id: p.id,
        lat: animated.lat!,
        lng: animated.lng!,
        color: KIND[kinds.get(p.id)!].color,
        label: p.plateNo ?? undefined,
        active: p.id === selected,
      };
    });

  // ເລືອກຄັນໃດ → ຊູມໃສ່ຄັນນັ້ນ · ບໍ່ເລືອກ → ເຫັນທັງກອງ
  const sel = positions.find((p) => p.id === selected && p.lat != null);

  /**
   * ລົດຄັນດຽວທີ່ຢູ່ໄກ (ຕ່າງແຂວງ) ດຶງໃຫ້ແຜນທີ່ zoom ອອກສຸດ ຈົນກຸ່ມທີ່ຢູ່
   * ນະຄອນຫຼວງກາຍເປັນຈຸດດຽວ. "ເນັ້ນກຸ່ມໃຫຍ່" ຈຶ່ງຕັດຄັນທີ່ຢູ່ນອກ ±0.6°
   * ຈາກຄ່າກາງອອກຊົ່ວຄາວ ເພື່ອໃຫ້ເຫັນລາຍລະອຽດບ່ອນທີ່ລົດຫຼາຍ.
   */
  // ເປີດມາໃຫ້ເນັ້ນກຸ່ມໃຫຍ່ກ່ອນ — ຄົນເບິ່ງຢາກເຫັນບ່ອນທີ່ລົດເຄື່ອນໄຫວປະຈຳວັນ
  // ບໍ່ແມ່ນຊູມອອກທັງປະເທດເພາະລົດຄັນດຽວທີ່ໄປຕ່າງແຂວງ
  const [focusCluster, setFocusCluster] = useState(true);
  const clustered = useMemo(() => {
    if (markers.length < 3) return markers;
    const lats = [...markers.map((m) => m.lat)].sort((a, b) => a - b);
    const lngs = [...markers.map((m) => m.lng)].sort((a, b) => a - b);
    const midLat = lats[Math.floor(lats.length / 2)];
    const midLng = lngs[Math.floor(lngs.length / 2)];
    return markers.filter((m) => Math.abs(m.lat - midLat) < 0.6 && Math.abs(m.lng - midLng) < 0.6);
  }, [markers]);

  const outliers = markers.length - clustered.length;
  const shown = sel ? markers.filter((m) => m.id === sel.id) : focusCluster ? clustered : markers;

  return (
    <div className="space-y-4">
      {/* ແຖບສະຫຼຸບ + ກັ່ນຕອງ */}
      <div className="flex flex-wrap items-center gap-2">
        {ORDER.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? null : k)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
              filter === k ? "border-primary bg-primary/5 font-semibold" : "border-border bg-card hover:bg-slate-50"
            }`}
          >
            <span className={`size-2.5 rounded-full ${KIND[k].dot}`} />
            <span className="text-muted">{KIND[k].label}</span>
            <span className="tabular font-bold">{summary[k]}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <select
            value={dept ?? ""}
            onChange={(e) => setDept(e.target.value || null)}
            className="max-w-48 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
            title="ກັ່ນຕອງຕາມພະແນກເຈົ້າຂອງລົດ"
          >
            <option value="">ທຸກພະແນກ ({positions.length})</option>
            {depts.map(([label, count]) => (
              <option key={label} value={label}>
                {label === NO_DEPT ? "ບໍ່ໄດ້ລະບຸພະແນກ" : label} ({count})
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາປ້າຍ / ຄົນຂັບ…"
            className="w-44 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          {updatedAt && <span className="text-xs text-muted">ອັບເດດ {updatedAt}</span>}
          <button
            onClick={load}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "ກຳລັງໂຫຼດ…" : "↻"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* ລາຍການລົດ */}
        <div className="max-h-[640px] space-y-1.5 overflow-y-auto pr-1">
          {list.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted">
              ບໍ່ພົບລົດຕາມເງື່ອນໄຂ
            </p>
          )}
          {list.map((p, i) => {
            const k = kinds.get(p.id)!;
            const active = p.id === selected;
            const addr = cleanAddress(p.address);
            // ຫົວກຸ່ມ: ສະແດງເມື່ອບໍ່ໄດ້ເລືອກພະແນກ ແລະ ພະແນກປ່ຽນຈາກແຖວກ່ອນ
            const group = !dept && (i === 0 || deptLabel(list[i - 1]) !== deptLabel(p)) ? deptLabel(p) : null;
            return (
              <div key={`g-${p.id}`}>
              {group && (
                <p className="mt-2 mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 first:mt-0">
                  {group === NO_DEPT ? "ບໍ່ໄດ້ລະບຸພະແນກ" : group}
                  <span className="font-normal text-slate-400">
                    {list.filter((x) => deptLabel(x) === group).length} ຄັນ
                  </span>
                </p>
              )}
              <button
                key={p.id}
                onClick={() => setSelected(active ? null : p.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className={`size-2.5 shrink-0 rounded-full ${KIND[k].dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate font-bold">{p.plateNo ?? p.name ?? p.id}</span>
                    <span className="shrink-0 text-[11px] text-muted">{p.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted">{ago(p.recordedAt)}</span>
                  </div>
                  <p className="truncate text-[11px] text-muted">
                    {addr ?? (p.lat != null ? `${p.lat.toFixed(4)}, ${p.lng!.toFixed(4)}` : "ບໍ່ມີພິກັດ")}
                    {p.driverName ? ` · ${p.driverName}` : ""}
                    {p.tripDestination ? ` · ໄປ ${p.tripDestination}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND[k].chip}`}
                >
                  {k === "moving" ? `${Math.round(p.speed ?? 0)}` : KIND[k].label}
                </span>
              </button>
              </div>
            );
          })}
        </div>

        {/* ແຜນທີ່ */}
        <div className="space-y-2">
          <TrackMap markers={shown} height={640} smoothMs={MOTION_MS} resetKey={selected} />

          {sel && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="font-bold">{sel.plateNo}</span>
                <span className="text-xs text-muted">{sel.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND[kinds.get(sel.id)!].chip}`}>
                  {KIND[kinds.get(sel.id)!].label}
                  {(sel.speed ?? 0) > 3 ? ` · ${Math.round(sel.speed!)} ກມ/ຊມ` : ""}
                </span>
                <span className="ml-auto text-xs text-muted">
                  ຂໍ້ມູນຫຼ້າສຸດ {sel.recordedAt ? new Date(sel.recordedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Vientiane" }) : "—"}
                </span>
              </div>
              <p className="text-sm">
                <span className="text-muted">ຢູ່ໃສ: </span>
                {addr === null || addr.key !== `${sel.lat!.toFixed(4)},${sel.lng!.toFixed(4)}` ? (
                  <span className="text-muted">ກຳລັງຫາທີ່ຢູ່…</span>
                ) : (
                  <strong>{addr.text ?? cleanAddress(sel.address) ?? "ບໍ່ພົບຊື່ສະຖານທີ່"}</strong>
                )}
              </p>
              <p className="tabular text-xs text-muted">
                {sel.lat!.toFixed(6)}, {sel.lng!.toFixed(6)}
                {sel.driverName ? ` · ຄົນຂັບ ${sel.driverName}` : ""}
                {sel.tripDestination ? ` · ໄປ ${sel.tripDestination}` : ""}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase">ຄວາມໄວ</p>
                  <p className="mt-0.5 font-bold tabular-nums">
                    {sel.speed == null ? "—" : `${Math.round(sel.speed)} ກມ/ຊມ`}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase">ທິດທາງ</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">
                    {sel.heading != null && (
                      <span
                        className="inline-block text-base leading-none text-primary"
                        style={{ transform: `rotate(${sel.heading}deg)` }}
                        aria-hidden="true"
                      >
                        ↑
                      </span>
                    )}
                    {directionLabel(sel.heading)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase">ເຄື່ອງຈັກ</p>
                  <p className="mt-0.5 font-bold">{engineLabel(sel.engineState)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase">ເລກໄລຍະທາງ GPS</p>
                  <p className="mt-0.5 font-bold tabular-nums">
                    {sel.mileageKm == null
                      ? "—"
                      : `${sel.mileageKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} ກມ`}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase">ນ້ຳມັນ</p>
                  <p className="mt-0.5 font-bold tabular-nums">{fuelLabel(sel.fuelLitre, sel.fuelPercent)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase">ແຫຼ່ງຂໍ້ມູນ</p>
                  <p className="mt-0.5 font-bold">{SOURCE_LABEL[sel.positionSource]}</p>
                </div>
              </div>

              <p className="mt-2 break-all text-[11px] text-muted">
                IMEI: <span className="font-medium text-foreground">{sel.imei ?? "—"}</span>
                {sel.gpsPlate && sel.gpsPlate !== sel.plateNo ? ` · ປ້າຍໃນ GPS: ${sel.gpsPlate}` : ""}
                {sel.gpsName && sel.gpsName !== sel.name ? ` · ຊື່ໃນ GPS: ${sel.gpsName}` : ""}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            {sel ? (
              <>
                <button onClick={() => setSelected(null)} className="font-semibold text-primary hover:underline">
                  ← ເບິ່ງທັງກອງ
                </button>
                {sel.imei && (
                  <Link
                    href={`/fleet/history?imei=${sel.imei}&from=${today}&to=${today}`}
                    className="ml-auto rounded-md bg-primary px-3 py-1.5 font-semibold text-white transition hover:bg-[#5d3e55]"
                  >
                    ▶ ເບິ່ງເສັ້ນທາງມື້ນີ້
                  </Link>
                )}
                <a
                  href={`https://maps.google.com/?q=${sel.lat},${sel.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`font-semibold text-primary hover:underline ${sel.imei ? "" : "ml-auto"}`}
                >
                  Google Maps ↗
                </a>
              </>
            ) : (
              <>
                <span>ສະແດງ {shown.length} ຄັນ · ກົດລົດໃນລາຍການເພື່ອຊູມໃສ່ຄັນນັ້ນ</span>
                {outliers > 0 && (
                  <button
                    onClick={() => setFocusCluster(!focusCluster)}
                    className="ml-auto font-semibold text-primary hover:underline"
                  >
                    {focusCluster
                      ? `ສະແດງທັງໝົດ (+${outliers} ຄັນຢູ່ຕ່າງແຂວງ)`
                      : `ເນັ້ນກຸ່ມໃຫຍ່ (ເຊື່ອງ ${outliers} ຄັນທີ່ຢູ່ໄກ)`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
