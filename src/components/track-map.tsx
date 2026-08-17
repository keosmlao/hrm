"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ແຜນທີ່ເສັ້ນທາງ / ຕຳແໜ່ງລົດ — ວາດເອງດ້ວຍ tile ຂອງ OpenStreetMap + SVG.
 *
 * ເປັນຫຍັງບໍ່ໃຊ້ Leaflet: ຫຼີກລ້ຽງການເພີ່ມ dependency ກ້ອນໃຫຍ່ສຳລັບແຜນທີ່
 * ອ່ານຢ່າງດຽວ. ວິທີ: Web Mercator → ຫາ zoom ທີ່ພໍດີກັບຈຸດທັງໝົດ → ວາງ tile
 * ເປັນຕາໜ່າງ → ແປງພິກັດເປັນ pixel ແລ້ວແຕ້ມທັບ.
 *
 * ຮອງຮັບ zoom (ປຸ່ມ / ລໍ້ເມົ້າ / double-click) ແລະ ລາກເລື່ອນ. ເມື່ອຜູ້ໃຊ້
 * ຍັງບໍ່ໄດ້ແຕະ ແຜນທີ່ຈະ fit ໃຫ້ເຫັນທຸກຈຸດເອງ ແລະ ຕິດຕາມຂໍ້ມູນໃໝ່ຕໍ່ໄປ.
 */

const TILE = 256;
/** ຈຳນວນຈຸດສູງສຸດຂອງເສັ້ນ — ຫຼາຍກວ່ານີ້ browser ຈະຊ້າໂດຍບໍ່ຈຳເປັນ */
const MAX_LINE_POINTS = 1500;
const MIN_Z = 2;
const MAX_Z = 18;

export type MapPoint = { lat: number; lng: number };
export type MapMarker = MapPoint & {
  label?: string;
  tone?: "start" | "end" | "current";
  /** ສີເອງ — ໃຊ້ແທນ tone ເມື່ອຕ້ອງການສີຕາມສະຖານະລົດ */
  color?: string;
  radius?: number;
  /** ເນັ້ນ (ວົງນອກ + ຕົວໜັງສືໜັກ) */
  active?: boolean;
  id?: string;
};

function project(lat: number, lng: number, z: number) {
  const size = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** zoom ໃຫຍ່ສຸດທີ່ຍັງໃສ່ກອບ w × h ໄດ້ໝົດ */
function fitZoom(pts: MapPoint[], w: number, h: number) {
  if (pts.length === 0) return 13;
  if (pts.length === 1) return 16;
  const minLat = Math.min(...pts.map((p) => p.lat));
  const maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng));
  const maxLng = Math.max(...pts.map((p) => p.lng));
  for (let z = MAX_Z; z >= MIN_Z; z--) {
    const a = project(maxLat, minLng, z);
    const b = project(minLat, maxLng, z);
    if (b.x - a.x <= w - 48 && b.y - a.y <= h - 48) return z;
  }
  return MIN_Z;
}

/** ຈຸດກາງທີ່ຜູ້ໃຊ້ລາກໄປເອງ — pixel ຂອງໂລກທີ່ zoom ປັດຈຸບັນ */
type Pan = { cx: number; cy: number };

export function TrackMap({
  points = [],
  trail = [],
  markers = [],
  height = 420,
  className = "",
  /** ໃຫ້ໝຸດເລື່ອນລື່ນເມື່ອຕຳແໜ່ງປ່ຽນ (ໜ້າຕິດຕາມສົດ) — ໜ່ວຍ ms, 0 = ປິດ */
  smoothMs = 0,
  resetKey,
}: {
  points?: MapPoint[];
  /** ສ່ວນທີ່ແລ່ນຜ່ານແລ້ວ (ຕອນ replay) — ວາດທັບເສັ້ນຫຼັກດ້ວຍສີເນັ້ນ */
  trail?: MapPoint[];
  markers?: MapMarker[];
  height?: number;
  className?: string;
  smoothMs?: number;
  /** ປ່ຽນຄ່ານີ້ = ກັບໄປ fit ອັດຕະໂນມັດ (ເຊັ່ນ ຕອນເລືອກລົດຄັນອື່ນ) */
  resetKey?: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: height });
  /**
   * ຊູມ ແລະ ການເລື່ອນ ແຍກກັນໂດຍເຈດຕະນາ:
   * ຊູມດ້ວຍປຸ່ມ +/− ຈະປ່ຽນແຕ່ລະດັບ ສ່ວນຈຸດກາງຍັງມາຈາກການ fit ອັດຕະໂນມັດ
   * ຈຶ່ງລົດທີ່ຕິດຕາມຢູ່**ຄ້າງກາງຈໍສະເໝີ** ແລະ ຍັງເລື່ອນຕາມຂໍ້ມູນໃໝ່.
   * ຕໍ່ເມື່ອລາກ ຫຼື ຊູມດ້ວຍລໍ້ເມົ້າ (ມີຈຸດຍຶດ) ຈຶ່ງຈະຢຸດຕິດຕາມ.
   */
  const [zoomAdj, setZoomAdj] = useState<number | null>(null);
  const [pan, setPan] = useState<Pan | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [panning, setPanning] = useState(false);

  // ປ່ຽນຄັນທີ່ຕິດຕາມ → ກັບໄປໂໝດ fit ອັດຕະໂນມັດ
  // (ປັບ state ຕອນ render ຕາມແບບ "adjusting state on prop change" ຂອງ React —
  //  ໃສ່ໃນ effect ຈະເກີດ render ຮອບສອງໂດຍບໍ່ຈຳເປັນ)
  const prevKey = useRef(resetKey);
  if (prevKey.current !== resetKey) {
    prevKey.current = resetKey;
    setZoomAdj(null);
    setPan(null);
  }

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * ຖານການຄິດ zoom/ຈຸດກາງ — ໃຊ້ `points` ເປັນຫຼັກເມື່ອມີ.
   * ສຳຄັນຕອນ replay: marker ຍ້າຍທຸກ frame ແຕ່ `points` ຄົງທີ່
   * ຈຶ່ງແຜນທີ່ບໍ່ຊູມເຂົ້າ-ອອກຕາມລົດ.
   */
  const all = (points.length ? points : markers).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0),
  );

  const { w, h } = size;

  // ລໍ້ເມົ້າ = zoom (ຕ້ອງຜູກແບບ non-passive ຈຶ່ງ preventDefault ໄດ້)
  useEffect(() => {
    const el = box.current;
    if (!el || all.length === 0) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  if (all.length === 0) {
    return (
      <div
        className={`grid place-items-center rounded-xl border border-border bg-card text-sm text-muted ${className}`}
        style={{ height }}
      >
        ບໍ່ມີພິກັດໃຫ້ສະແດງ
      </div>
    );
  }

  const autoZ = fitZoom(all, w, h);
  const z = zoomAdj ?? autoZ;

  const xs = all.map((p) => project(p.lat, p.lng, z).x);
  const ys = all.map((p) => project(p.lat, p.lng, z).y);
  const cx = pan?.cx ?? (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = pan?.cy ?? (Math.min(...ys) + Math.max(...ys)) / 2;
  const originX = cx - w / 2;
  const originY = cy - h / 2;

  const toPx = (p: MapPoint) => {
    const q = project(p.lat, p.lng, z);
    return { x: q.x - originX, y: q.y - originY };
  };

  /**
   * ຊູມ ±1.
   * ບໍ່ມີຈຸດຍຶດ (ປຸ່ມ +/−) → ປ່ຽນແຕ່ລະດັບ, ຈຸດກາງຍັງ fit ເອງ ຈຶ່ງລົດຢູ່ກາງຈໍຕໍ່.
   * ມີຈຸດຍຶດ (ລໍ້ເມົ້າ / double-click) → ຕຶງຈຸດໃຕ້ເມົ້າໄວ້ບ່ອນເກົ່າ.
   */
  function zoomBy(delta: number, px?: number, py?: number) {
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, z + delta));
    if (nz === z) return;
    const scale = 2 ** (nz - z);

    if (px == null || py == null) {
      // ຮັກສາໂໝດຕິດຕາມ — ຖ້າເຄີຍລາກໄວ້ ກໍພຽງແຕ່ຂະຫຍາຍພິກັດຈຸດກາງຕາມ zoom ໃໝ່
      if (pan) setPan({ cx: pan.cx * scale, cy: pan.cy * scale });
      setZoomAdj(nz);
      return;
    }
    const wx = originX + px;
    const wy = originY + py;
    setPan({ cx: wx * scale - px + w / 2, cy: wy * scale - py + h / 2 });
    setZoomAdj(nz);
  }

  const maxTile = 2 ** z;
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + w) / TILE); tx++) {
    for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + h) / TILE); ty++) {
      if (ty < 0 || ty >= maxTile) continue;
      const wrapped = ((tx % maxTile) + maxTile) % maxTile;
      tiles.push({
        key: `${z}-${tx}-${ty}`,
        url: `https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png`,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      });
    }
  }

  const toPath = (list: MapPoint[]) => {
    const stride = Math.max(1, Math.ceil(list.length / MAX_LINE_POINTS));
    return list
      .filter((p, i) => (i % stride === 0 || i === list.length - 1) && (p.lat !== 0 || p.lng !== 0))
      .map(toPx)
      .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join("");
  };
  const d = toPath(points);
  const dTrail = trail.length > 1 ? toPath(trail) : "";

  const TONE = {
    start: { fill: "#10b981" },
    end: { fill: "#ef4444" },
    current: { fill: "#6d28d9" },
  };

  /**
   * ວາງປ້າຍແບບກັນທັບກັນ — ຖ້າກອບປ້າຍຊ້ອນກັບປ້າຍທີ່ວາງໄປແລ້ວ ໃຫ້ຂ້າມ.
   * ຈຳເປັນເມື່ອລົດຢູ່ຊ້ອນກັນໜາແໜ້ນ. ຄັນທີ່ເລືອກວາງກ່ອນສະເໝີ.
   */
  const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const placed = [...markers]
    .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)))
    .map((m) => {
      const p = toPx(m);
      const r = m.radius ?? (m.active ? 9 : 7);
      let showLabel = false;
      if (m.label) {
        const fontW = (m.active ? 7.6 : 6.4) * m.label.length;
        const b = { x1: p.x + r + 2, y1: p.y - 8, x2: p.x + r + 6 + fontW, y2: p.y + 8 };
        const hit = boxes.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
        if (!hit && b.x2 < w && b.x1 > 0 && b.y1 > 0 && b.y2 < h) {
          boxes.push(b);
          showLabel = true;
        }
      }
      return { m, p, r, fill: m.color ?? TONE[m.tone ?? "current"].fill, showLabel };
    })
    .sort((a, b) => Number(Boolean(a.m.active)) - Number(Boolean(b.m.active)));

  // ເລື່ອນລື່ນ — ປິດຕອນລາກ/ຊູມ ບໍ່ດັ່ງນັ້ນໝຸດຈະໄຫຼຕາມແບບຜິດປົກກະຕິ
  const tween =
    smoothMs > 0 && !panning
      ? { transition: `cx ${smoothMs}ms linear, cy ${smoothMs}ms linear` }
      : undefined;
  const mapTween =
    smoothMs > 0 && !panning
      ? { transition: `left ${smoothMs}ms linear, top ${smoothMs}ms linear` }
      : undefined;

  return (
    <div
      ref={box}
      className={`relative touch-none overflow-hidden rounded-xl border border-border bg-slate-100 ${
        panning ? "cursor-grabbing" : "cursor-grab"
      } ${className}`}
      style={{ height }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, cx, cy };
        setPanning(true);
      }}
      onPointerMove={(e) => {
        const g = drag.current;
        if (!g) return;
        setPan({ cx: g.cx - (e.clientX - g.x), cy: g.cy - (e.clientY - g.y) });
      }}
      onPointerUp={() => {
        drag.current = null;
        setPanning(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPanning(false);
      }}
      onDoubleClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        zoomBy(1, e.clientX - r.left, e.clientY - r.top);
      }}
    >
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.key}
          src={t.url}
          alt=""
          width={TILE}
          height={TILE}
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: t.left, top: t.top, ...mapTween }}
        />
      ))}

      <svg className="pointer-events-none absolute inset-0" width={w} height={h}>
        {d && (
          <>
            <path d={d} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
            <path d={d} fill="none" stroke="#6d28d9" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" opacity={dTrail ? 0.25 : 1} />
          </>
        )}
        {dTrail && (
          <path d={dTrail} fill="none" stroke="#6d28d9" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {placed.map(({ m, p, r, fill, showLabel }, i) => (
          <g key={m.id ?? i}>
            {m.active && <circle cx={p.x} cy={p.y} r={r + 7} fill={fill} opacity={0.25} style={tween} />}
            <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="#fff" strokeWidth={2.5} style={tween} />
            {showLabel && m.label && (
              <text
                x={p.x + r + 4}
                y={p.y + 4}
                fontSize={m.active ? 13 : 11}
                fontWeight={m.active ? 700 : 600}
                fill="#1e293b"
                stroke="#fff"
                strokeWidth={3}
                paintOrder="stroke"
                style={
                  smoothMs > 0 && !panning
                    ? { transition: `x ${smoothMs}ms linear, y ${smoothMs}ms linear` }
                    : undefined
                }
              >
                {m.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* ປຸ່ມຄວບຄຸມ */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {[
          { label: "+", onClick: () => zoomBy(1), title: "ຊູມເຂົ້າ" },
          { label: "−", onClick: () => zoomBy(-1), title: "ຊູມອອກ" },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.title}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={b.onClick}
            className="size-8 rounded-md border border-border bg-white/90 text-lg leading-none font-bold text-slate-700 shadow-sm hover:bg-white"
          >
            {b.label}
          </button>
        ))}
        {(zoomAdj !== null || pan) && (
          <button
            type="button"
            title="ກັບໄປເຫັນທັງໝົດ"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { setZoomAdj(null); setPan(null); }}
            className="size-8 rounded-md border border-border bg-white/90 text-sm font-bold text-slate-700 shadow-sm hover:bg-white"
          >
            ⛶
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-600">
        zoom {z}
        {pan ? " · ມຸມມອງເອງ" : " · ຕິດຕາມອັດຕະໂນມັດ"}
      </div>

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-0 bottom-0 bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-600 hover:underline"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
