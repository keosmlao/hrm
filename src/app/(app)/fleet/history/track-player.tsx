"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrackMap, type MapMarker, type MapPoint } from "@/components/track-map";

/**
 * ຫຼິ້ນຄືນເສັ້ນທາງ (replay) — ໃຫ້ລົດແລ່ນຕາມເສັ້ນທາງທີ່ບັນທຶກໄວ້ຕາມເວລາຈິງ.
 *
 * ເປັນ replay ບໍ່ແມ່ນ realtime: Open API ເປັນ polling (ບໍ່ມີ websocket)
 * ຈຶ່ງເຄື່ອນໄຫວສົດແທ້ບໍ່ໄດ້ ແຕ່ຂໍ້ມູນຍ້ອນຫຼັງມີທຸກ ~4 ວິນາທີ ພຽງພໍໃຫ້ລື່ນ.
 *
 * ຕຳແໜ່ງລະຫວ່າງສອງຈຸດຄິດແບບ linear interpolation ຕາມເວລາ ຈຶ່ງລົດເລື່ອນ
 * ຕໍ່ເນື່ອງ ບໍ່ກະໂດດເປັນຈຸດໆ.
 */

export type PlayPoint = MapPoint & { t: number; speed: number | null };

const SPEEDS = [
  { x: 60, label: "60×" },
  { x: 300, label: "300×" },
  { x: 900, label: "900×" },
  { x: 3600, label: "3600×" },
];

/** ຄວາມໄວທີ່ຖືວ່າ "ກຳລັງແລ່ນ" (ກມ/ຊມ) */
const MOVING_KMH = 3;
/** ຈອດດົນກວ່ານີ້ຈຶ່ງຄຸ້ມທີ່ຈະຂ້າມ (ມິນລິວິນາທີ) */
const SKIP_GAP_MS = 3 * 60_000;

/**
 * ຖ້າເວລາ `t` ຢູ່ໃນຊ່ວງຈອດທີ່ຍາວກວ່າ SKIP_GAP_MS ຄືນເວລາທີ່ລົດເລີ່ມແລ່ນຕໍ່
 * ບໍ່ດັ່ງນັ້ນຄືນ null (ບໍ່ຕ້ອງຂ້າມ).
 */
function nextMoveAfter(points: PlayPoint[], t: number): number | null {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  if ((points[lo].speed ?? 0) > MOVING_KMH) return null;
  for (let i = lo + 1; i < points.length; i++) {
    if ((points[i].speed ?? 0) > MOVING_KMH) {
      return points[i].t - t >= SKIP_GAP_MS ? points[i].t : null;
    }
  }
  return null;
}

function clockLao(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    timeZone: "Asia/Vientiane",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TrackPlayer({
  points,
  stops = [],
}: {
  points: PlayPoint[];
  stops?: (MapPoint & { seq: number })[];
}) {
  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 0;
  const span = Math.max(1, t1 - t0);

  /**
   * ເລີ່ມຫຼິ້ນທີ່ຈຸດ**ທີ່ລົດເລີ່ມເຄື່ອນໄຫວ** ບໍ່ແມ່ນ 00:00.
   * ຂໍ້ມູນເລີ່ມທ່ຽງຄືນ ແລະ ລົດມັກຈອດຄ້າງຄືນຫຼາຍຊົ່ວໂມງ — ຖ້າເລີ່ມທີ່ t0
   * ຜູ້ໃຊ້ຈະກົດ ▶ ແລ້ວເບິ່ງຄືບໍ່ມີຫຍັງເກີດຂຶ້ນ.
   */
  const moveAt = useMemo(() => {
    const i = points.findIndex((p) => (p.speed ?? 0) > MOVING_KMH);
    return i >= 0 ? points[i].t : t0;
  }, [points, t0]);

  const [clock, setClock] = useState(moveAt);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(300);
  /** ຂ້າມຊ່ວງທີ່ຈອດດົນ — ບໍ່ດັ່ງນັ້ນຈະລໍຖ້າຊ່ວງພັກທ່ຽງ 2 ຊົ່ວໂມງ */
  const [skipStops, setSkipStops] = useState(true);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  // ເສັ້ນທາງເຕັມ — ຄົງທີ່ ຈຶ່ງແຜນທີ່ບໍ່ຄິດ zoom ໃໝ່ທຸກ frame
  const route = useMemo<MapPoint[]>(() => points.map((p) => ({ lat: p.lat, lng: p.lng })), [points]);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setClock((c) => {
        let next = c + dt * rate;
        // ຢູ່ໃນຊ່ວງຈອດດົນ → ກະໂດດໄປຈຸດທີ່ເລີ່ມແລ່ນຕໍ່
        if (skipStops) {
          const jump = nextMoveAfter(points, next);
          if (jump != null && jump > next) next = jump;
        }
        if (next >= t1) {
          setPlaying(false);
          return t1;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, rate, t1, skipStops, points]);

  // ຫາຈຸດປັດຈຸບັນ + ແຊກຄ່າລະຫວ່າງສອງຈຸດ
  const { pos, idx, speed } = useMemo(() => {
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (points[mid].t <= clock) lo = mid;
      else hi = mid - 1;
    }
    const a = points[lo];
    const b = points[Math.min(lo + 1, points.length - 1)];
    const gap = b.t - a.t;
    const r = gap > 0 ? Math.min(1, Math.max(0, (clock - a.t) / gap)) : 0;
    return {
      idx: lo,
      speed: a.speed,
      pos: { lat: a.lat + (b.lat - a.lat) * r, lng: a.lng + (b.lng - a.lng) * r },
    };
  }, [clock, points]);

  const trail = useMemo(() => [...route.slice(0, idx + 1), pos], [route, idx, pos]);

  const markers: MapMarker[] = [
    { ...route[0], tone: "start" },
    ...stops.map((s) => ({ lat: s.lat, lng: s.lng, color: "#f59e0b", radius: 5, id: `s${s.seq}` })),
    { ...route[route.length - 1], tone: "end" },
    { ...pos, color: (speed ?? 0) > 3 ? "#2563eb" : "#64748b", radius: 9, active: true, id: "car" },
  ];

  const pct = ((clock - t0) / span) * 100;

  return (
    <div className="space-y-2">
      <TrackMap points={route} trail={trail} markers={markers} height={460} />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <button
          onClick={() => {
            if (clock >= t1) setClock(moveAt);
            setPlaying(!playing);
          }}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#5d3e55]"
        >
          {playing ? "⏸ ຢຸດ" : clock >= t1 ? "↻ ຫຼິ້ນຄືນ" : "▶ ຫຼິ້ນ"}
        </button>

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={skipStops} onChange={(e) => setSkipStops(e.target.checked)} />
          ຂ້າມຊ່ວງຈອດ
        </label>

        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s.x}
              onClick={() => setRate(s.x)}
              className={`rounded px-2 py-1 text-xs font-semibold transition ${
                rate === s.x ? "bg-primary/15 text-primary" : "text-muted hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(((clock - t0) / span) * 1000)}
          onChange={(e) => {
            setPlaying(false);
            setClock(t0 + (Number(e.target.value) / 1000) * span);
          }}
          className="min-w-40 flex-1 accent-[#6d28d9]"
        />

        <span className="tabular text-sm font-medium whitespace-nowrap">{clockLao(clock)}</span>
        <span className="tabular w-20 text-right text-sm whitespace-nowrap text-muted">
          {speed == null ? "—" : `${Math.round(speed)} ກມ/ຊມ`}
        </span>
        <span className="tabular w-12 text-right text-xs text-muted">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}
