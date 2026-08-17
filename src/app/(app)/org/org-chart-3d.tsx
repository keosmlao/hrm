"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * ຜັງອົງກອນ 3 ມິຕິ — ບໍລິສັດ → ຝ່າຍ → ພະແນກ → ໜ່ວຍງານ → ພະນັກງານ.
 *
 * ບໍ່ໃຊ້ library ພາຍນອກ: ຈັດ layout ເອງແບບ tidy-tree ແລ້ວແຕ້ມ
 * ເສັ້ນເຊື່ອມດ້ວຍ SVG ສ່ວນກ່ອງເປັນ div ທີ່ຍົກຂຶ້ນດ້ວຍ `translateZ`
 * ຕາມຊັ້ນ ຈຶ່ງເຫັນເປັນຊັ້ນລອຍຢູ່ເທິງເສັ້ນ. ຄວາມໜາຂອງກ່ອງມາຈາກ
 * box-shadow ຫຼາຍຊັ້ນ (ຖືກກວ່າການ render ໜ້າຂ້າງແທ້ໆ ແລະ ລື່ນກວ່າ).
 *
 * ຜັງທັງບໍລິສັດກວ້າງເກີນອ່ານ ຈຶ່ງມີຕົວເລືອກຂອບເຂດ: ເລືອກພະແນກແລ້ວ
 * ຜັງຈະຕັດເອົາສະເພາະກິ່ງນັ້ນມາເປັນຮາກ ແລະ ເຫັນເຖິງລາຍຊື່ພະນັກງານ.
 */

export type NodeKind = "root" | "division" | "department" | "unit" | "employee";

export type ChartNode = {
  id: string;
  kind: NodeKind;
  code: string;
  name: string;
  /** ຫົວໜ້າໜ່ວຍ — ສຳລັບພະນັກງານແມ່ນຕຳແໜ່ງ */
  head: string | null;
  /** ຈຳນວນຄົນ — null ຄືບໍ່ຕ້ອງສະແດງ (ຂັ້ນພະນັກງານ) */
  count: number | null;
  children: ChartNode[];
};

type Placed = {
  node: ChartNode;
  depth: number;
  /** ຈຸດກາງແນວນອນ */
  x: number;
  y: number;
  w: number;
  h: number;
};

const SLOT = 196;
const GAP_X = 22;
const ROW_Y = [0, 178, 344, 496, 640];
const NODE_W = [246, 200, 190, 178, 172];
const NODE_H = [92, 84, 78, 68, 62];
const LIFT = [78, 52, 30, 12, 4];
const MAX_DEPTH = ROW_Y.length - 1;

const STYLE: Record<
  NodeKind,
  { bg: string; edge: string; text: string; sub: string }
> = {
  root: { bg: "#4c3247", edge: "#33202f", text: "#ffffff", sub: "#e7dbe4" },
  division: { bg: "#714b67", edge: "#513349", text: "#ffffff", sub: "#ecdfe8" },
  department: {
    bg: "#017e84",
    edge: "#01585d",
    text: "#ffffff",
    sub: "#d6f0f1",
  },
  unit: { bg: "#ffffff", edge: "#cfc9cf", text: "#2f2a2f", sub: "#736d73" },
  employee: {
    bg: "#f6f1f5",
    edge: "#d8ccd5",
    text: "#2f2a2f",
    sub: "#736d73",
  },
};

const LABEL: Record<NodeKind, string> = {
  root: "ບໍລິສັດ",
  division: "ຝ່າຍ",
  department: "ພະແນກ",
  unit: "ໜ່ວຍງານ",
  employee: "ພະນັກງານ",
};

/** ຄວາມໜາຂອງກ່ອງ — ວາງເງົາເປັນຊັ້ນລົງລຸ່ມ ຈຶ່ງເບິ່ງຄືແທ່ງທຶບເມື່ອຜັງຖືກງ່ຽງ */
function slab(edge: string, deep: number): string {
  const layers: string[] = [];
  for (let i = 1; i <= deep; i++) layers.push(`0 ${i}px 0 ${edge}`);
  layers.push(`0 ${deep + 10}px ${deep + 14}px rgba(28,20,26,.3)`);
  return layers.join(",");
}

/** ຈັດຕຳແໜ່ງທຸກ node — ໃບຢູ່ຊ່ອງຂອງໃຜມັນ, ພໍ່ຢູ່ກາງລູກ */
function buildLayout(root: ChartNode, open: Set<string>) {
  const placed: Placed[] = [];
  const edges: { from: Placed; to: Placed }[] = [];
  let cursor = 0;

  function make(node: ChartNode, depth: number, x: number): Placed {
    const d = Math.min(depth, MAX_DEPTH);
    return { node, depth: d, x, y: ROW_Y[d], w: NODE_W[d], h: NODE_H[d] };
  }

  function walk(node: ChartNode, depth: number): Placed {
    const kids = open.has(node.id) ? node.children : [];
    if (kids.length === 0) {
      const p = make(node, depth, cursor + SLOT / 2);
      cursor += SLOT + GAP_X;
      placed.push(p);
      return p;
    }
    const children = kids.map((k) => walk(k, depth + 1));
    const p = make(
      node,
      depth,
      (children[0].x + children[children.length - 1].x) / 2,
    );
    placed.push(p);
    for (const c of children) edges.push({ from: p, to: c });
    return p;
  }

  walk(root, 0);
  const maxDepth = placed.reduce((m, p) => Math.max(m, p.depth), 0);
  return {
    placed,
    edges,
    width: Math.max(cursor - GAP_X, SLOT),
    height: ROW_Y[maxDepth] + NODE_H[maxDepth],
  };
}

/** ເສັ້ນຂໍ້ສອກ ພໍ່ → ລູກ */
function elbow(from: Placed, to: Placed): string {
  const y1 = from.y + from.h;
  const y2 = to.y;
  const mid = y1 + (y2 - y1) / 2;
  return `M ${from.x} ${y1} L ${from.x} ${mid} L ${to.x} ${mid} L ${to.x} ${y2}`;
}

function findNode(node: ChartNode, id: string): ChartNode | null {
  if (node.id === id) return node;
  for (const c of node.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

/** ກິ່ງທີ່ຂະຫຍາຍໄດ້ — ຂ້າມກິ່ງທີ່ລູກເປັນພະນັກງານ ຖ້າບໍ່ໄດ້ຂໍ */
function expandable(
  node: ChartNode,
  withEmployees: boolean,
  into = new Set<string>(),
): Set<string> {
  if (node.children.length === 0) return into;
  if (!withEmployees && node.children[0].kind === "employee") return into;
  into.add(node.id);
  for (const c of node.children) expandable(c, withEmployees, into);
  return into;
}

/** ເປີດຮາກ ແລະ ລູກຊັ້ນທຳອິດ — ພໍໃຫ້ເຫັນພາບລວມໂດຍບໍ່ກວ້າງເກີນ */
function defaultOpen(node: ChartNode): Set<string> {
  const s = new Set<string>([node.id]);
  for (const c of node.children) if (c.children.length > 0) s.add(c.id);
  return s;
}

const PAD = 90;

export function OrgChart3D({ root }: { root: ChartNode }) {
  const [scopeId, setScopeId] = useState(root.id);
  const [open, setOpen] = useState<Set<string>>(() => defaultOpen(root));
  const [tilt, setTilt] = useState(20);
  const [turn, setTurn] = useState(0);
  const [zoom, setZoom] = useState(0.5);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    tilt: number;
    turn: number;
  } | null>(null);
  const fitted = useRef(false);

  const scope = useMemo(() => findNode(root, scopeId) ?? root, [root, scopeId]);
  const { placed, edges, width, height } = useMemo(
    () => buildLayout(scope, open),
    [scope, open],
  );

  // ລາຍການໃຫ້ເລືອກຂອບເຂດ — ຝ່າຍ ແລະ ພະແນກທັງໝົດ
  const divisions = root.children;
  const [divisionId, setDivisionId] = useState("");
  const departments = useMemo(
    () =>
      divisionId
        ? (divisions.find((d) => d.id === divisionId)?.children ?? [])
        : divisions.flatMap((d) => d.children),
    [divisions, divisionId],
  );

  const fitTo = useCallback((available: number, content: number) => {
    const z = Math.min(
      1,
      Math.max(0.22, (available - 32) / (content + PAD * 2)),
    );
    setZoom(Number(z.toFixed(3)));
  }, []);

  // ວັດແທກຄັ້ງທຳອິດຜ່ານ ResizeObserver (ຍິງເອງຫຼັງ observe) ຈຶ່ງບໍ່ຕ້ອງ setState ໃນ effect ໂດຍກົງ
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (fitted.current) return;
      fitted.current = true;
      fitTo(entry.contentRect.width, width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitTo, width]);

  /** ປ່ຽນຂອບເຂດ: ຕັ້ງ node ທີ່ເປີດໃໝ່ ແລ້ວປັບ zoom ໃຫ້ພໍດີກັບຜັງໃໝ່ທັນທີ */
  function applyScope(node: ChartNode) {
    const next = defaultOpen(node);
    setScopeId(node.id);
    setOpen(next);
    fitTo(box.current?.clientWidth ?? 1200, buildLayout(node, next).width);
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, tilt, turn };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setTilt(Math.min(62, Math.max(0, d.tilt + (e.clientY - d.y) * 0.25)));
    setTurn(Math.min(34, Math.max(-34, d.turn + (e.clientX - d.x) * 0.2)));
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  const stageH = height + PAD * 2;
  // ຂະຫຍາຍລົງເຖິງພະນັກງານໄດ້ສະເພາະຕອນສ່ອງພະແນກດຽວ — ບໍ່ດັ່ງນັ້ນຈະກວ້າງເປັນໝື່ນ px
  const withEmployees = scope.kind === "department" || scope.kind === "unit";
  const branchIds = useMemo(
    () => expandable(scope, withEmployees),
    [scope, withEmployees],
  );
  const allOpen =
    branchIds.size > 0 && [...branchIds].every((id) => open.has(id));

  const select =
    "rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-muted">ເບິ່ງຕາມ</span>

        <select
          value={divisionId}
          onChange={(e) => {
            const id = e.target.value;
            setDivisionId(id);
            applyScope(id ? (findNode(root, id) ?? root) : root);
          }}
          className={select}
          aria-label="ຝ່າຍ"
        >
          <option value="">ທຸກຝ່າຍ</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={scope.kind === "department" ? scope.id : ""}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              applyScope(
                divisionId ? (findNode(root, divisionId) ?? root) : root,
              );
              return;
            }
            const dep = findNode(root, id);
            if (dep) applyScope(dep);
          }}
          className={select}
          aria-label="ພະແນກ"
        >
          <option value="">ທຸກພະແນກ</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.count} ຄົນ)
            </option>
          ))}
        </select>

        {scope.id !== root.id && (
          <button
            onClick={() => {
              setDivisionId("");
              applyScope(root);
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold hover:bg-slate-50"
          >
            ທັງບໍລິສັດ
          </button>
        )}

        <button
          onClick={() =>
            setOpen(allOpen ? defaultOpen(scope) : new Set(branchIds))
          }
          className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold hover:bg-slate-50"
        >
          {allOpen ? "ຫຍໍ້ທັງໝົດ" : "ຂະຫຍາຍທັງໝົດ"}
        </button>
        <button
          onClick={() => {
            setTilt(tilt === 0 ? 20 : 0);
            setTurn(0);
          }}
          className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold hover:bg-slate-50"
        >
          {tilt === 0 ? "ງ່ຽງ 3D" : "ເບິ່ງແບບຮາບ"}
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() =>
              setZoom((z) => Math.max(0.22, Number((z - 0.1).toFixed(3))))
            }
            aria-label="ຫຍໍ້"
            className="size-8 rounded-lg border border-border bg-card font-semibold hover:bg-slate-50"
          >
            −
          </button>
          <span className="tabular w-12 text-center text-muted">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() =>
              setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(3))))
            }
            aria-label="ຂະຫຍາຍ"
            className="size-8 rounded-lg border border-border bg-card font-semibold hover:bg-slate-50"
          >
            +
          </button>
          <button
            onClick={() => fitTo(box.current?.clientWidth ?? 1200, width)}
            className="ml-1 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold hover:bg-slate-50"
          >
            ພໍດີຈໍ
          </button>
        </div>
      </div>

      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative touch-none overflow-auto rounded-2xl border border-border bg-gradient-to-b from-slate-100 to-slate-200 select-none"
        style={{
          perspective: "1800px",
          perspectiveOrigin: "50% 26%",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <div
          style={{
            width: (width + PAD * 2) * zoom,
            height: stageH * zoom,
            position: "relative",
          }}
        >
          {/* ຍໍ້-ຂະຫຍາຍແຍກຈາກການໝູນ ຈຶ່ງບໍ່ເລື່ອນອອກນອກກອບເມື່ອ zoom ປ່ຽນ */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: width + PAD * 2,
              height: stageH,
              transformStyle: "preserve-3d",
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                transform: `rotateX(${tilt}deg) rotateY(${turn}deg)`,
                transformOrigin: "50% 14%",
                transition: dragging ? "none" : "transform .25s ease-out",
              }}
            >
              <svg
                width={width + PAD * 2}
                height={stageH}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "translateZ(0px)",
                }}
                aria-hidden
              >
                <g transform={`translate(${PAD},${PAD})`}>
                  {edges.map(({ from, to }) => {
                    const lit = focus === from.node.id || focus === to.node.id;
                    return (
                      <path
                        key={`${from.node.id}->${to.node.id}`}
                        d={elbow(from, to)}
                        fill="none"
                        stroke={lit ? "#714b67" : "#a9a1a8"}
                        strokeWidth={lit ? 3 : 2}
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </g>
              </svg>

              {placed.map((p) => {
                const s = STYLE[p.node.kind];
                const hasKids = p.node.children.length > 0;
                const isOpen = open.has(p.node.id);
                const active = focus === p.node.id;
                const lift = LIFT[p.depth] + (active ? 16 : 0);
                const style: React.CSSProperties = {
                  position: "absolute",
                  left: PAD + p.x - p.w / 2,
                  top: PAD + p.y,
                  width: p.w,
                  height: p.h,
                  background: s.bg,
                  color: s.text,
                  borderRadius: 14,
                  border:
                    p.node.kind === "unit" || p.node.kind === "employee"
                      ? "1px solid #dedade"
                      : "none",
                  boxShadow: slab(s.edge, active ? 10 : 7),
                  transform: `translateZ(${lift}px)`,
                  transition:
                    "transform .18s ease-out, box-shadow .18s ease-out",
                  cursor: hasKids ? "pointer" : "default",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 2,
                  textDecoration: "none",
                };

                const inner = (
                  <>
                    <div
                      className="flex items-center gap-1.5"
                      style={{ color: s.sub, fontSize: 10 }}
                    >
                      <span>{LABEL[p.node.kind]}</span>
                      {p.node.code && (
                        <span className="tabular">{p.node.code}</span>
                      )}
                      {p.node.count != null && (
                        <span className="tabular ml-auto">
                          {p.node.count} ຄົນ
                        </span>
                      )}
                    </div>

                    <div
                      className="truncate font-semibold"
                      style={{
                        fontSize: p.depth === 0 ? 16 : p.depth >= 3 ? 12.5 : 14,
                      }}
                      title={p.node.name}
                    >
                      {p.node.name}
                    </div>

                    <div
                      className="truncate"
                      style={{ color: s.sub, fontSize: 10.5 }}
                      title={p.node.head ?? undefined}
                    >
                      {p.node.head ??
                        (p.node.kind === "employee"
                          ? "-"
                          : "ຍັງບໍ່ໄດ້ກຳນົດຫົວໜ້າ")}
                    </div>

                    {hasKids && (
                      <span
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: -11,
                          marginLeft: -11,
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: "#ffffff",
                          color: "#2f2a2f",
                          border: "1px solid #dedade",
                          fontSize: 13,
                          lineHeight: "20px",
                          textAlign: "center",
                          fontWeight: 700,
                          boxShadow: "0 2px 4px rgba(0,0,0,.2)",
                        }}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    )}
                  </>
                );

                if (p.node.kind === "employee") {
                  return (
                    <Link
                      key={p.node.id}
                      data-node
                      href={`/employees/${p.node.code}`}
                      style={{ ...style, cursor: "pointer" }}
                      onMouseEnter={() => setFocus(p.node.id)}
                      onMouseLeave={() => setFocus(null)}
                    >
                      {inner}
                    </Link>
                  );
                }

                return (
                  <div
                    key={p.node.id}
                    data-node
                    role={hasKids ? "button" : undefined}
                    tabIndex={hasKids ? 0 : -1}
                    onClick={() => hasKids && toggle(p.node.id)}
                    onKeyDown={(e) => {
                      if (hasKids && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggle(p.node.id);
                      }
                    }}
                    onMouseEnter={() => setFocus(p.node.id)}
                    onMouseLeave={() => setFocus(null)}
                    style={style}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted">
        ລາກເມົ້າໃສ່ພື້ນຫຼັງເພື່ອໝູນມຸມ · ກົດກ່ອງເພື່ອຍໍ້/ຂະຫຍາຍລູກ ·{" "}
        {withEmployees
          ? "ກົດຊື່ພະນັກງານເພື່ອເປີດປະຫວັດ"
          : "ເລືອກພະແນກເພື່ອເບິ່ງລົງເຖິງລາຍຊື່ພະນັກງານ"}
      </p>
    </div>
  );
}
