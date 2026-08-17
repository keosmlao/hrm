"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { MENU, type Role } from "@/lib/menu";
import { saveMenuPermissions } from "./actions";

/**
 * ຟອມຕັ້ງສິດເມນູຂອງ role ໜຶ່ງ — ຕິກເມນູທີ່ຢາກໃຫ້ເຫັນ.
 * ບໍ່ຕິກ = ເຊື່ອງເມນູ **ແລະ** ເປີດ URL ນັ້ນບໍ່ໄດ້ (ບັງຄັບຢູ່ layout).
 */
export function RoleForm({
  role,
  label,
  checked,
  configured,
  userCount,
}: {
  role: Role;
  label: string;
  checked: string[];
  /** ເຄີຍບັນທຶກແລ້ວບໍ — ຖ້າຍັງ ຄ່າທີ່ເຫັນຄືຄ່າເລີ່ມຕົ້ນຈາກ code */
  configured: boolean;
  userCount: number;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(checked));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (key: string) =>
    setSel((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function submit(form: FormData) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await saveMenuPermissions(form);
      if (res.ok) setMsg("ບັນທຶກແລ້ວ");
      else setErr(res.error);
    });
  }

  return (
    <form action={submit} className="rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="role" value={role} />
      {[...sel].map((k) => (
        <input key={k} type="hidden" name="key" value={k} />
      ))}

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <h3 className="font-semibold">{label}</h3>
        <span className="text-xs text-muted">{userCount} ຜູ້ໃຊ້</span>
        {configured ? (
          <Badge tone="green">ຕັ້ງຄ່າແລ້ວ</Badge>
        ) : (
          <Badge tone="gray">ຄ່າເລີ່ມຕົ້ນ</Badge>
        )}
        <span className="ml-auto text-xs text-muted">
          ເລືອກ {sel.size} ຈາກ {MENU.flatMap((g) => g.items).length} ເມນູ
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU.map((g) => {
          const keys = g.items.map((i) => i.key);
          const allOn = keys.every((k) => sel.has(k));
          return (
            <div key={g.title}>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted uppercase">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() =>
                    setSel((s) => {
                      const next = new Set(s);
                      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
                      return next;
                    })
                  }
                />
                {g.title}
              </label>
              <ul className="space-y-1">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={sel.has(i.key)} onChange={() => toggle(i.key)} />
                      {i.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {err && (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>
      )}
      {msg && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55] disabled:opacity-50"
        >
          {pending ? "ກຳລັງບັນທຶກ…" : `ບັນທຶກສິດຂອງ${label}`}
        </button>
        <button
          type="button"
          onClick={() => setSel(new Set(checked))}
          disabled={pending}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
        >
          ຄືນຄ່າເດີມ
        </button>
      </div>
    </form>
  );
}
