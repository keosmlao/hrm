"use client";

import { useMemo, useState } from "react";
import { Badge, EmptyRow, Table, Td, Th } from "@/components/ui";
import { VehicleEdit, type BranchOption, type DeptOption, type DivisionOption } from "./vehicle-edit";

/**
 * ຕາຕະລາງລົດ ພ້ອມຫ້ອງຄົ້ນຫາ.
 *
 * ກັ່ນຕອງຝັ່ງ client ເພາະລົດມີພຽງ ~30 ຄັນ — ພິມແລ້ວເຫັນຜົນທັນທີ
 * ບໍ່ຕ້ອງໂຫຼດໜ້າໃໝ່ທຸກຕົວອັກສອນ.
 */

export type VehicleRow = {
  id: string;
  plateNo: string;
  name: string;
  status: string | null;
  statusLabel: string | null;
  statusTone: "green" | "amber" | "blue" | "gray" | null;
  typeId: string | null;
  typeName: string;
  category: string | null;
  departmentCode: string | null;
  divisionCode: string | null;
  divisionName: string | null;
  deptName: string | null;
  branchCode: string | null;
  branchName: string | null;
  mileage: number | null;
  imei: string | null;
  deviceModel: string | null;
  sim: string | null;
  hasCamera: boolean;
  fuelMethod: string | null;
  tankLitre: number | null;
  kmPerLitre: number | null;
  /** YYYY-MM-DD */
  expireDate: string | null;
  daysLeft: number | null;
};

type Quick = "all" | "expired" | "unassigned" | "noBranch" | "noGps";

/** ລະຫັດພິເສດຂອງແທັບ "ບໍ່ສັງກັດຝ່າຍ" — ຫຼີກລ້ຽງຊົນກັບລະຫັດຝ່າຍຈິງ */
const SHARED = "__shared";

const QUICK: { key: Quick; label: string }[] = [
  { key: "all", label: "ທັງໝົດ" },
  { key: "expired", label: "GPS ໝົດອາຍຸ" },
  { key: "unassigned", label: "ບໍ່ໄດ້ລະບຸພະແນກ" },
  { key: "noBranch", label: "ບໍ່ໄດ້ລະບຸສາຂາ" },
  { key: "noGps", label: "ບໍ່ພົບໃນ GPS" },
];

export function VehicleTable({
  rows,
  types,
  departments,
  divisions,
  branches,
}: {
  rows: VehicleRow[];
  types: { id: string; name: string }[];
  departments: DeptOption[];
  divisions: DivisionOption[];
  branches: BranchOption[];
}) {
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<Quick>("all");
  /** "" = ທຸກຝ່າຍ · SHARED = ລົດທີ່ບໍ່ໄດ້ສັງກັດຝ່າຍໃດ */
  const [tab, setTab] = useState("");
  const [branch, setBranch] = useState("");

  /**
   * ແທັບສ້າງຈາກຂໍ້ມູນຈິງ — ສະແດງສະເພາະ "ຝ່າຍທີ່ໃຊ້ງານ" (ມີລົດຢູ່ແທ້)
   * ບໍ່ແມ່ນຝ່າຍທັງໝົດໃນອົງກອນ ຈຶ່ງບໍ່ມີແທັບຫວ່າງລ້າໆ.
   */
  const tabs = useMemo(() => {
    const byDiv = new Map<string, { code: string; name: string; count: number }>();
    let shared = 0;
    for (const v of rows) {
      if (!v.divisionCode) {
        shared += 1;
        continue;
      }
      const hit = byDiv.get(v.divisionCode);
      if (hit) hit.count += 1;
      else byDiv.set(v.divisionCode, { code: v.divisionCode, name: v.divisionName ?? v.divisionCode, count: 1 });
    }
    const list = [{ code: "", name: "ທຸກຝ່າຍ", count: rows.length }, ...[...byDiv.values()].sort((a, b) => a.code.localeCompare(b.code))];
    if (shared) list.push({ code: SHARED, name: "ໃຊ້ຮ່ວມ (ບໍ່ສັງກັດຝ່າຍ)", count: shared });
    return list;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((v) => {
      if (tab === SHARED ? v.divisionCode : tab && v.divisionCode !== tab) return false;
      if (quick === "expired" && !(v.daysLeft != null && v.daysLeft < 0)) return false;
      if (quick === "unassigned" && v.departmentCode) return false;
      if (quick === "noBranch" && v.branchCode) return false;
      if (quick === "noGps" && v.imei && v.deviceModel) return false;
      if (branch && v.branchCode !== branch) return false;
      if (!needle) return true;
      // ຄົ້ນຫາຄວບທຸກຊ່ອງທີ່ຄົນມັກໃຊ້ຫາ — ປ້າຍ, ຍີ່ຫໍ້, IMEI, SIM, ພະແນກ, ສາຂາ, ປະເພດ
      return [
        v.plateNo, v.name, v.typeName, v.category, v.divisionName, v.deptName, v.branchName,
        v.imei, v.sim, v.deviceModel, v.statusLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, quick, tab, branch]);

  return (
    <>
      {/* ແທັບຕາມຝ່າຍທີ່ໃຊ້ງານລົດ */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.code || "all"}
            onClick={() => setTab(t.code)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition ${
              tab === t.code
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.name}
            <span
              className={`tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                tab === t.code ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">
          ລົດທັງໝົດ ({shown.length}
          {shown.length !== rows.length ? ` ຈາກ ${rows.length}` : ""})
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {QUICK.map((f) => (
            <button
              key={f.key}
              onClick={() => setQuick(quick === f.key ? "all" : f.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                quick === f.key
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            aria-label="ກັ່ນຕອງຕາມສາຂາ"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">ທຸກສາຂາ</option>
            {branches.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ຄົ້ນຫາ ປ້າຍ / ຍີ່ຫໍ້ / IMEI / ພະແນກ / ສາຂາ…"
              className="w-72 rounded-lg border border-border bg-card py-2 pr-8 pl-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="ລ້າງ"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ປ້າຍທະບຽນ</Th>
            <Th>ຍີ່ຫໍ້</Th>
            <Th>ປະເພດ</Th>
            <Th>ຝ່າຍ / ພະແນກ</Th>
            <Th>ສາຂາປະຈຳ</Th>
            <Th className="text-right">ໄມລ໌</Th>
            <Th>ອຸປະກອນ GPS</Th>
            <Th>ນ້ຳມັນ</Th>
            <Th>ໝົດອາຍຸບໍລິການ</Th>
            <Th>ສະຖານະ</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <EmptyRow colSpan={11} text={rows.length === 0 ? "ຍັງບໍ່ມີລົດ" : "ບໍ່ພົບລົດຕາມເງື່ອນໄຂ"} />
          )}
          {shown.map((v) => (
            <tr key={v.id}>
              <Td className="font-medium">
                {v.plateNo}
                {v.plateNo.startsWith("GPS-") && (
                  <span className="ml-2 text-xs font-normal text-amber-600">ບໍ່ມີປ້າຍໃນ GPS</span>
                )}
              </Td>
              <Td>{v.name}</Td>
              <Td className="text-xs text-muted">
                {v.typeName}
                {v.category && <span className="block text-[11px] opacity-70">{v.category}</span>}
              </Td>
              <Td className="text-xs">
                {v.deptName ? (
                  <>
                    <span className="block font-medium">{v.divisionName}</span>
                    <span className="block text-muted">{v.deptName}</span>
                  </>
                ) : (
                  <span className="text-muted">ໃຊ້ຮ່ວມ</span>
                )}
              </Td>
              <Td className="text-xs">
                {v.branchName ? (
                  <>
                    <span className="block font-medium">{v.branchName}</span>
                    <span className="text-muted">{v.branchCode}</span>
                  </>
                ) : (
                  <span className="text-amber-600">ຍັງບໍ່ລະບຸ</span>
                )}
              </Td>
              <Td className="text-right tabular">{v.mileage ? v.mileage.toLocaleString() : "-"}</Td>
              <Td className="text-xs text-muted">
                {v.deviceModel || v.sim ? (
                  <>
                    <span className="font-medium text-foreground">{v.deviceModel ?? "-"}</span>
                    {v.hasCamera && <Badge tone="violet">ມີກ້ອງ</Badge>}
                    <span className="tabular block opacity-80">SIM {v.sim ?? "-"}</span>
                    <span className="tabular block opacity-60">{v.imei}</span>
                  </>
                ) : (
                  <span className="text-amber-600">ບໍ່ພົບໃນ GPS</span>
                )}
              </Td>
              <Td className="text-xs">
                {v.fuelMethod === "sensor" && <Badge tone="blue">ເຊັນເຊີ</Badge>}
                {v.fuelMethod === "rate" && <Badge tone="violet">ອັດຕາ</Badge>}
                {v.imei && !v.fuelMethod && <span className="text-muted">ວັດບໍ່ໄດ້</span>}
                {(v.tankLitre || v.kmPerLitre) && (
                  <span className="block text-[11px] text-muted">
                    {v.tankLitre ? `ຖັງ ${v.tankLitre} ລ` : ""}
                    {v.kmPerLitre ? ` · ${v.kmPerLitre} ກມ/ລ` : ""}
                  </span>
                )}
              </Td>
              <Td className="text-xs">
                {v.expireDate ? (
                  <>
                    <span className="tabular">{v.expireDate}</span>
                    <span
                      className={`block text-[11px] ${
                        v.daysLeft != null && v.daysLeft < 0
                          ? "font-semibold text-rose-600"
                          : v.daysLeft != null && v.daysLeft <= 30
                            ? "font-semibold text-amber-600"
                            : "text-muted"
                      }`}
                    >
                      {v.daysLeft == null
                        ? ""
                        : v.daysLeft < 0
                          ? `ໝົດແລ້ວ ${-v.daysLeft} ວັນ`
                          : `ອີກ ${v.daysLeft} ວັນ`}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </Td>
              <Td>
                {v.statusLabel && v.statusTone ? (
                  <Badge tone={v.statusTone}>{v.statusLabel}</Badge>
                ) : (
                  <span className="text-xs text-muted">{v.status ?? "-"}</span>
                )}
              </Td>
              <Td className="text-right">
                <VehicleEdit
                  types={types}
                  departments={departments}
                  divisions={divisions}
                  branches={branches}
                  vehicle={{
                    id: v.id,
                    plateNo: v.plateNo,
                    name: v.name,
                    status: v.status,
                    currentMileage: v.mileage,
                    departmentCode: v.departmentCode,
                    vehicleTypeId: v.typeId,
                    branchCode: v.branchCode,
                  }}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
