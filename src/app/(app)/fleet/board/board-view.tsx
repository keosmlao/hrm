"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Table, Td, Th } from "@/components/ui";
import { refreshPositions } from "../tracking/actions";
import type { VehiclePosition } from "@/lib/fleet-live";

/**
 * ບອດລົດຕາມພະແນກ — **ຕາຕະລາງລາຍລະອຽດ** ທີ່ຈັດກຸ່ມດ້ວຍແຖວຫົວພະແນກ.
 * ໃຊ້ຂໍ້ມູນສົດອັນດຽວກັບໜ້າຕິດຕາມ ຈຶ່ງບໍ່ຕ້ອງຍິງ GPS ຊ້ຳ.
 */

type Kind = "moving" | "idle" | "off" | "nosignal";

const STALE_MIN = 30;
const POLL_MS = 20000;

function minutesAgo(at: string | null): number | null {
  if (!at) return null;
  const t = Date.parse(at.includes("T") ? at : at.replace(" ", "T"));
  return Number.isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 60000));
}

function classify(p: VehiclePosition | undefined): Kind {
  if (!p || p.lat == null || p.lng == null) return "nosignal";
  const m = minutesAgo(p.recordedAt);
  if (m == null || m > STALE_MIN) return "nosignal";
  if ((p.speed ?? 0) > 3) return "moving";
  if (p.engineState === "1" || p.engineState?.toLowerCase() === "on") return "idle";
  return "off";
}

const KIND: Record<Kind, { label: string; dot: string; tone: "green" | "amber" | "gray" | "red" }> = {
  moving: { label: "ກຳລັງແລ່ນ", dot: "bg-emerald-500", tone: "green" },
  idle: { label: "ຕິດເຄື່ອງຈອດ", dot: "bg-amber-500", tone: "amber" },
  off: { label: "ດັບເຄື່ອງ", dot: "bg-slate-400", tone: "gray" },
  nosignal: { label: "ບໍ່ມີສັນຍານ", dot: "bg-rose-400", tone: "red" },
};

function ago(at: string | null): string {
  const m = minutesAgo(at);
  if (m == null) return "—";
  if (m < 1) return "ຫາກໍ່ນີ້";
  if (m < 60) return `${m} ນທ`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} ຊມ` : `${Math.floor(h / 24)} ມື້`;
}

function cleanAddress(a: string | null | undefined): string | null {
  if (!a) return null;
  return a.replace(/^จ\./, "").replace(/\s*เขต\s*/, " · ").trim() || null;
}

export type BoardVehicle = {
  id: string;
  plateNo: string;
  name: string;
  imei: string | null;
  typeName: string | null;
  mileage: number | null;
  deviceModel: string | null;
  tankLitre: number | null;
  kmPerLitre: number | null;
  fuelMethod: string | null;
  /** ວັນທີ່ບໍລິການ GPS ໝົດອາຍຸ (YYYY-MM-DD) */
  expireDate: string | null;
  daysLeft: number | null;
};

export type Group = {
  key: string;
  deptName: string;
  divisionName: string | null;
  vehicles: BoardVehicle[];
};

export function BoardView({
  groups,
  initialPositions,
  today,
}: {
  groups: Group[];
  initialPositions: VehiclePosition[];
  today: string;
}) {
  const [positions, setPositions] = useState(initialPositions);
  const [updatedAt, setUpdatedAt] = useState("");
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      try {
        setPositions(await refreshPositions());
        setUpdatedAt(new Date().toLocaleTimeString("lo-LA"));
      } catch {
        /* ຮອບຕໍ່ໄປລອງໃໝ່ */
      }
    });

  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const total = groups.reduce((n, g) => n + g.vehicles.length, 0);
  const running = positions.filter((p) => classify(p) === "moving").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-border bg-card px-3 py-1.5">
          ລົດທັງໝົດ <strong className="tabular">{total}</strong> ຄັນ · {groups.length} ພະແນກ
        </span>
        <span className="rounded-lg border border-border bg-card px-3 py-1.5">
          ກຳລັງແລ່ນ <strong className="tabular text-emerald-700">{running}</strong>
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          {updatedAt && <span>ອັບເດດ {updatedAt}</span>}
          <button
            onClick={load}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "ກຳລັງໂຫຼດ…" : "↻"}
          </button>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ປ້າຍທະບຽນ</Th>
            <Th>ຍີ່ຫໍ້ / ປະເພດ</Th>
            <Th className="text-right">ໄມລ໌</Th>
            <Th>ສະຖານະປັດຈຸບັນ</Th>
            <Th>ຕຳແໜ່ງ / ໜ້າວຽກ</Th>
            <Th>ອຸປະກອນ · ນ້ຳມັນ</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              <tr className="bg-slate-50">
                <td colSpan={7} className="border-b border-border px-4 py-2">
                  <span className="font-semibold">{g.deptName}</span>
                  {g.divisionName && <span className="ml-2 text-xs text-muted">{g.divisionName}</span>}
                  <span className="tabular ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {g.vehicles.length} ຄັນ
                  </span>
                </td>
              </tr>

              {g.vehicles.map((v) => {
                const p = posById.get(v.id);
                const k = classify(p);
                const addr = cleanAddress(p?.address);
                return (
                  <tr key={v.id}>
                    <Td className="font-medium whitespace-nowrap">
                      <span className={`mr-2 inline-block size-2.5 rounded-full align-middle ${KIND[k].dot}`} />
                      {v.plateNo}
                    </Td>
                    <Td className="text-xs">
                      <span className="block font-medium text-foreground">{v.name}</span>
                      <span className="block text-muted">{v.typeName ?? "—"}</span>
                    </Td>
                    <Td className="text-right tabular">
                      {v.mileage ? v.mileage.toLocaleString() : "—"}
                    </Td>
                    <Td className="text-xs">
                      <Badge tone={KIND[k].tone}>
                        {k === "moving" ? `${Math.round(p?.speed ?? 0)} ກມ/ຊມ` : KIND[k].label}
                      </Badge>
                      <span className="mt-0.5 block text-muted">{ago(p?.recordedAt ?? null)}</span>
                    </Td>
                    <Td className="max-w-64 text-xs">
                      <span className="block truncate text-muted">
                        {addr ?? (p?.lat != null ? `${p.lat.toFixed(4)}, ${p.lng!.toFixed(4)}` : "ບໍ່ມີພິກັດ")}
                      </span>
                      {p?.tripDestination && (
                        <span className="text-primary block truncate font-medium">
                          ໄປ {p.tripDestination}
                        </span>
                      )}
                      {p?.driverName && <span className="block truncate">{p.driverName}</span>}
                    </Td>
                    <Td className="text-xs text-muted">
                      <span className="block">{v.deviceModel ?? "—"}</span>
                      <span className="block">
                        {v.fuelMethod === "sensor" ? "ເຊັນເຊີ" : v.fuelMethod === "rate" ? "ອັດຕາ" : "ວັດບໍ່ໄດ້"}
                        {v.tankLitre ? ` · ຖັງ ${v.tankLitre} ລ` : ""}
                        {v.kmPerLitre ? ` · ${v.kmPerLitre} ກມ/ລ` : ""}
                      </span>
                      {v.expireDate && (
                        <span
                          className={`block ${
                            v.daysLeft != null && v.daysLeft < 0 ? "font-semibold text-rose-600" : ""
                          }`}
                        >
                          ໝົດອາຍຸ {v.expireDate}
                          {v.daysLeft != null && v.daysLeft < 0 ? ` (${-v.daysLeft} ວັນ)` : ""}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {v.imei && (
                        <Link
                          href={`/fleet/history?imei=${v.imei}&from=${today}&to=${today}`}
                          className="text-primary rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
                        >
                          ເສັ້ນທາງ
                        </Link>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
