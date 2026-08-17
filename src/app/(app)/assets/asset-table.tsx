"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, EmptyRow, Table, Td, Th, inputClass } from "@/components/ui";
import { updateAsset } from "./actions";

export type AssetRow = {
  code: string;
  name: string;
  typeCode: string | null;
  typeName: string | null;
  locationCode: string | null;
  locationName: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  branchCode: string | null;
  branchName: string | null;
  brand: string | null;
  modelInfo: string | null;
  serialNo: string | null;
  unitCode: string | null;
  /** ຜູ້ຖືຄອງທີ່ SML ບັນທຶກເປັນຂໍ້ຄວາມ (ບໍ່ໄດ້ຜູກລະຫັດພະນັກງານ) */
  holderName: string | null;
  remark: string | null;
  status: number | null;
  /** ພະນັກງານທີ່ HRM ມອບໃຫ້ຢູ່ຕອນນີ້ (ຜູກລະຫັດແທ້) */
  assignedTo: string | null;
};

export type Option = { code: string; name: string };

/**
 * ຄັງຊັບສິນຈາກ SML (623 ລາຍການ) — ຄົ້ນຫາ/ກັ່ນຕອງຝັ່ງ client ເພື່ອໃຫ້ພິມແລ້ວເຫັນທັນທີ,
 * ພ້ອມແກ້ໄຂລາຍການໄດ້ຈາກ HRM ໂດຍກົງ.
 */
export function AssetTable({
  rows,
  types,
  locations,
  departments,
  branches,
}: {
  rows: AssetRow[];
  types: Option[];
  locations: Option[];
  departments: Option[];
  branches: Option[];
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("");
  const [branch, setBranch] = useState("");
  const [editing, setEditing] = useState<AssetRow | null>(null);

  const tabs = useMemo(() => {
    const by = new Map<string, { code: string; name: string; count: number }>();
    for (const r of rows) {
      const key = r.typeCode ?? "";
      const hit = by.get(key);
      if (hit) hit.count += 1;
      else by.set(key, { code: key, name: r.typeName ?? "ບໍ່ລະບຸປະເພດ", count: 1 });
    }
    return [{ code: "", name: "ທັງໝົດ", count: rows.length }, ...[...by.values()].sort((a, b) => b.count - a.count)];
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab && r.typeCode !== tab) return false;
      if (branch && r.branchCode !== branch) return false;
      if (!needle) return true;
      return [
        r.code, r.name, r.brand, r.modelInfo, r.serialNo,
        r.holderName, r.assignedTo, r.branchName, r.locationName, r.departmentName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, tab, branch]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.code || "all"}
            onClick={() => setTab(t.code)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition ${
              tab === t.code ? "border-primary font-medium text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.name}
            <span className={`tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${tab === t.code ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">
          ຄັງຊັບສິນ ({shown.length}
          {shown.length !== rows.length ? ` ຈາກ ${rows.length}` : ""})
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="ກັ່ນຕອງຕາມສາຂາ"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">ທຸກສາຂາ</option>
            {branches.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ຄົ້ນຫາ ລະຫັດ / ຊື່ / ຍີ່ຫໍ້ / S/N / ຜູ້ຖືຄອງ…"
              className="w-80 rounded-lg border border-border bg-card py-2 pr-8 pl-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="ລ້າງ" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-foreground">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ລະຫັດ</Th>
            <Th>ຊື່ຊັບສິນ</Th>
            <Th>ຍີ່ຫໍ້ / ລຸ້ນ / S/N</Th>
            <Th>ຜູ້ຖືຄອງ</Th>
            <Th>ບ່ອນຕັ້ງ / ສາຂາ</Th>
            <Th>ສະຖານະ</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && <EmptyRow colSpan={7} text="ບໍ່ພົບຊັບສິນຕາມເງື່ອນໄຂ" />}
          {shown.map((r) => (
            <tr key={r.code}>
              <Td className="tabular font-medium whitespace-nowrap">{r.code}</Td>
              <Td>
                {r.name}
                {r.unitCode && <span className="ml-1 text-xs text-muted">({r.unitCode})</span>}
              </Td>
              <Td className="text-xs text-muted">
                {r.brand && <span className="block text-foreground">{r.brand}</span>}
                {r.modelInfo && <span className="block">{r.modelInfo}</span>}
                {r.serialNo && <span className="tabular block opacity-70">S/N {r.serialNo}</span>}
                {!r.brand && !r.modelInfo && !r.serialNo && "—"}
              </Td>
              <Td className="text-xs">
                {r.assignedTo ? (
                  <>
                    <span className="block font-medium">{r.assignedTo}</span>
                    <span className="block text-[11px] text-muted">ມອບຜ່ານ HRM</span>
                  </>
                ) : r.holderName ? (
                  <>
                    <span className="block">{r.holderName}</span>
                    <span className="block text-[11px] text-muted">ຈາກ SML</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td className="text-xs text-muted">
                {r.locationName ?? "—"}
                {r.branchName && <span className="block">{r.branchName}</span>}
              </Td>
              <Td>
                {r.assignedTo ? (
                  <Badge tone="blue">ກຳລັງໃຊ້</Badge>
                ) : r.status === 0 ? (
                  <Badge tone="green">ພ້ອມໃຊ້</Badge>
                ) : (
                  <Badge tone="gray">ປິດ</Badge>
                )}
              </Td>
              <Td className="text-right">
                <button
                  onClick={() => setEditing(r)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-slate-50"
                >
                  ແກ້ໄຂ
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {editing && (
        <EditModal
          asset={editing}
          types={types}
          locations={locations}
          departments={departments}
          branches={branches}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditModal({
  asset,
  types,
  locations,
  departments,
  branches,
  onClose,
}: {
  asset: AssetRow;
  types: Option[];
  locations: Option[];
  departments: Option[];
  branches: Option[];
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setErr(null);
    start(async () => {
      const res = await updateAsset(form);
      if (res.error) setErr(res.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">ແກ້ໄຂຊັບສິນ · {asset.code}</h3>
          <button onClick={onClose} className="text-sm text-muted hover:underline">ປິດ</button>
        </div>

        <form action={submit} className="space-y-4">
          <input type="hidden" name="code" value={asset.code} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">ຊື່ຊັບສິນ</span>
              <input name="name" defaultValue={asset.name} className={inputClass} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ປະເພດ</span>
              <select name="typeCode" defaultValue={asset.typeCode ?? ""} className={inputClass}>
                <option value="">—</option>
                {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ບ່ອນຕັ້ງ</span>
              <select name="locationCode" defaultValue={asset.locationCode ?? ""} className={inputClass}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ພະແນກ</span>
              <select name="departmentCode" defaultValue={asset.departmentCode ?? ""} className={inputClass}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ສາຂາ</span>
              <select name="branchCode" defaultValue={asset.branchCode ?? ""} className={inputClass}>
                <option value="">—</option>
                {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ຍີ່ຫໍ້</span>
              <input name="brand" defaultValue={asset.brand ?? ""} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ລຸ້ນ</span>
              <input name="modelInfo" defaultValue={asset.modelInfo ?? ""} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Serial number</span>
              <input name="serialNo" defaultValue={asset.serialNo ?? ""} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ຫົວໜ່ວຍ</span>
              <input name="unitCode" defaultValue={asset.unitCode ?? ""} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ຜູ້ຖືຄອງ (ຂໍ້ຄວາມ SML)</span>
              <input name="holderName" defaultValue={asset.holderName ?? ""} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ສະຖານະ</span>
              <select name="status" defaultValue={String(asset.status ?? 0)} className={inputClass}>
                <option value="0">ໃຊ້ງານ</option>
                <option value="1">ປິດ / ປົດລະວາງ</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">ໝາຍເຫດ</span>
              <input name="remark" defaultValue={asset.remark ?? ""} className={inputClass} />
            </label>
          </div>

          {err && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55] disabled:opacity-50">
              {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
            </button>
            <button type="button" onClick={onClose} disabled={pending} className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50">
              ຍົກເລີກ
            </button>
            <span className="ml-auto text-xs text-muted">ບັນທຶກລົງ SML (`as_asset`) ໂດຍກົງ</span>
          </div>
        </form>
      </div>
    </div>
  );
}
