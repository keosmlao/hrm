"use client";

import { useState } from "react";
import Link from "next/link";

export type EmpLeaf = {
  code: string;
  name: string;
  position: string;
  isManager: boolean;
};
export type UnitGroup = {
  code: string;
  name: string;
  count: number;
  head: EmpLeaf | null;
  employees: EmpLeaf[];
};
export type DeptGroup = {
  code: string;
  name: string;
  count: number;
  head: EmpLeaf | null;
  units: UnitGroup[];
  directEmployees: EmpLeaf[];
};
export type DivGroup = {
  code: string;
  name: string;
  count: number;
  head: EmpLeaf | null;
  departments: DeptGroup[];
};

/**
 * ໂຄງສ້າງພະນັກງານແບບ tree — ຝ່າຍ ▸ ພະແນກ ▸ ໜ່ວຍງານ ▸ ພະນັກງານ
 * ຫົວໜ້າຂອງແຕ່ລະໜ່ວຍ (ຈາກ hrm_org_head) ຂຶ້ນເທິງສຸດ ພ້ອມປ້າຍ "ຫົວໜ້າ"
 */
export function OrgTree({ divisions }: { divisions: DivGroup[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const expandAll = () => {
    const all = new Set<string>();
    for (const v of divisions) {
      all.add(`v:${v.code}`);
      for (const d of v.departments) {
        all.add(`d:${v.code}:${d.code}`);
        for (const u of d.units) all.add(`u:${v.code}:${d.code}:${u.code}`);
      }
    }
    setOpen(all);
  };

  return (
    <div>
      <div className="mb-3 flex gap-3 text-xs">
        <button onClick={expandAll} className="text-primary hover:underline">
          ຂະຫຍາຍທັງໝົດ
        </button>
        <button onClick={() => setOpen(new Set())} className="text-primary hover:underline">
          ຫຍໍ້ທັງໝົດ
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ul>
          {divisions.map((v) => {
            const vKey = `v:${v.code}`;
            const vOpen = open.has(vKey);
            return (
              <li key={v.code} className="border-b border-border last:border-0">
                <Node level={0} open={vOpen} onToggle={() => toggle(vKey)} label={v.name} count={v.count} tone="div" />
                {vOpen && (
                  <ul>
                    {v.head && <EmployeeRow level={1} emp={v.head} isHead />}
                    {v.departments.map((d) => {
                      const dKey = `d:${v.code}:${d.code}`;
                      const dOpen = open.has(dKey);
                      const hasChildren =
                        d.units.length > 0 || d.directEmployees.length > 0 || !!d.head;
                      return (
                        <li key={d.code}>
                          <Node
                            level={1}
                            open={dOpen}
                            onToggle={() => toggle(dKey)}
                            label={d.name}
                            count={d.count}
                            tone="dept"
                            hasChildren={hasChildren}
                          />
                          {dOpen && (
                            <ul>
                              {d.head && <EmployeeRow level={2} emp={d.head} isHead />}
                              {d.directEmployees.map((e) => (
                                <EmployeeRow key={e.code} level={2} emp={e} />
                              ))}
                              {d.units.map((u) => {
                                const uKey = `u:${v.code}:${d.code}:${u.code}`;
                                const uOpen = open.has(uKey);
                                return (
                                  <li key={u.code}>
                                    <Node
                                      level={2}
                                      open={uOpen}
                                      onToggle={() => toggle(uKey)}
                                      label={u.name}
                                      count={u.count}
                                      tone="unit"
                                    />
                                    {uOpen && (
                                      <>
                                        {u.head && <EmployeeRow level={3} emp={u.head} isHead />}
                                        {u.employees.map((e) => (
                                          <EmployeeRow key={e.code} level={3} emp={e} />
                                        ))}
                                      </>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const INDENT = ["pl-4", "pl-10", "pl-16", "pl-24"];

function Node({
  level,
  open,
  onToggle,
  label,
  count,
  tone,
  hasChildren = true,
}: {
  level: number;
  open: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  tone: "div" | "dept" | "unit";
  hasChildren?: boolean;
}) {
  const toneCls = {
    div: "font-semibold text-slate-800",
    dept: "font-medium text-slate-700",
    unit: "text-slate-600",
  }[tone];
  return (
    <button
      onClick={onToggle}
      disabled={!hasChildren}
      className={`flex w-full items-center gap-2 ${INDENT[level]} py-2.5 pr-4 text-left text-sm transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent`}
    >
      <span
        className={`w-4 shrink-0 text-xs text-slate-400 transition-transform ${
          open ? "rotate-90" : ""
        } ${hasChildren ? "" : "opacity-0"}`}
      >
        ▸
      </span>
      <span className={`flex-1 truncate ${toneCls}`}>{label}</span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">
        {count}
      </span>
    </button>
  );
}

function EmployeeRow({
  level,
  emp,
  isHead = false,
}: {
  level: number;
  emp: EmpLeaf;
  isHead?: boolean;
}) {
  return (
    <Link
      href={`/employees/${emp.code}`}
      className={`flex items-center gap-3 ${INDENT[level]} border-t border-border/50 py-2 pr-4 text-sm hover:bg-slate-50 ${
        isHead ? "bg-violet-50/50" : ""
      }`}
    >
      <span className="w-4 shrink-0" />
      <span className="tabular-nums text-xs text-muted">{emp.code}</span>
      <span className={`flex-1 truncate text-primary ${isHead ? "font-semibold" : ""}`}>
        {emp.name}
      </span>
      {isHead && (
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
          ຫົວໜ້າ
        </span>
      )}
      <span className="shrink-0 truncate text-xs text-muted">{emp.position}</span>
    </Link>
  );
}
