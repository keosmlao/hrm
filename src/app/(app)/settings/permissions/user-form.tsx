"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { MENU, MENU_ITEMS } from "@/lib/menu";
import { saveUserMenuPermissions } from "./actions";

export type UserRow = {
  id: string;
  username: string;
  employeeName: string | null;
  employeeCode: string | null;
  role: string;
  roleLabel: string;
  /** ສິດຕໍ່ຄົນທີ່ບັນທຶກໄວ້ — null = ຍັງໃຊ້ສິດຕາມ role */
  override: string[] | null;
  /** ສິດທີ່ຈະໄດ້ຮັບຈາກ role ຖ້າບໍ່ມີ override */
  roleKeys: string[];
};

/**
 * ສິດເມນູ "ຕໍ່ພະນັກງານ" — ເລືອກຄົນຈາກລາຍການ ແລ້ວຕິກເມນູທີ່ຢາກໃຫ້ເຫັນ.
 * ຕິກ "ໃຊ້ຕາມສິດຂອງຕຳແໜ່ງ" = ລຶບການຕັ້ງສະເພາະຄົນອອກ.
 */
export function UserPermissionList({ users }: { users: UserRow[] }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      `${u.username} ${u.employeeName ?? ""} ${u.employeeCode ?? ""} ${u.roleLabel}`
        .toLowerCase()
        .includes(needle),
    );
  }, [users, q]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <h3 className="font-semibold">ສິດຕໍ່ພະນັກງານລາຍຄົນ</h3>
        <span className="text-xs text-muted">{users.length} ບັນຊີ</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ຄົ້ນຫາ ຊື່ / ລະຫັດ / ຊື່ຜູ້ໃຊ້…"
          className="ml-auto w-64 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <ul className="divide-y divide-border">
        {shown.length === 0 && (
          <li className="p-6 text-center text-sm text-muted">ບໍ່ພົບຜູ້ໃຊ້</li>
        )}
        {shown.map((u) => (
          <UserItem
            key={u.id}
            user={u}
            open={openId === u.id}
            onToggle={() => setOpenId(openId === u.id ? null : u.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function UserItem({
  user,
  open,
  onToggle,
}: {
  user: UserRow;
  open: boolean;
  onToggle: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const [useRole, setUseRole] = useState(user.override === null);
  const [sel, setSel] = useState<Set<string>>(new Set(user.override ?? user.roleKeys));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await saveUserMenuPermissions(form);
      if (res.ok) setMsg(res.cleared ? "ກັບໄປໃຊ້ສິດຕາມຕຳແໜ່ງແລ້ວ" : "ບັນທຶກແລ້ວ");
      else setErr(res.error);
    });
  }

  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {user.employeeName ?? user.username}
            {user.employeeCode && <span className="ml-2 text-xs text-muted">{user.employeeCode}</span>}
          </p>
          <p className="truncate text-xs text-muted">
            {user.username} · {user.roleLabel}
          </p>
        </div>
        {isAdmin ? (
          <Badge tone="violet">ເຫັນທຸກເມນູ</Badge>
        ) : user.override ? (
          <Badge tone="amber">ຕັ້ງສະເພາະຄົນ · {user.override.length} ເມນູ</Badge>
        ) : (
          <Badge tone="gray">ຕາມຕຳແໜ່ງ · {user.roleKeys.length} ເມນູ</Badge>
        )}
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>

      {open && !isAdmin && (
        <form action={submit} className="space-y-3 border-t border-border bg-slate-50/60 p-4">
          <input type="hidden" name="userId" value={user.id} />
          {!useRole && [...sel].map((k) => <input key={k} type="hidden" name="key" value={k} />)}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="useRole"
              checked={useRole}
              onChange={(e) => setUseRole(e.target.checked)}
            />
            ໃຊ້ຕາມສິດຂອງຕຳແໜ່ງ ({user.roleLabel})
          </label>

          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${useRole ? "pointer-events-none opacity-40" : ""}`}>
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
                          <input
                            type="checkbox"
                            checked={sel.has(i.key)}
                            onChange={() =>
                              setSel((s) => {
                                const next = new Set(s);
                                if (next.has(i.key)) next.delete(i.key);
                                else next.add(i.key);
                                return next;
                              })
                            }
                          />
                          {i.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {err && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{err}</p>}
          {msg && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55] disabled:opacity-50"
            >
              {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
            </button>
            <span className="ml-auto text-xs text-muted">
              {useRole ? `${user.roleKeys.length}` : sel.size} / {MENU_ITEMS.length} ເມນູ
            </span>
          </div>
        </form>
      )}

      {open && isAdmin && (
        <p className="border-t border-border bg-slate-50/60 p-4 text-sm text-muted">
          ບັນຊີ ADMIN ເຫັນທຸກເມນູສະເໝີ — ຈຳກັດບໍ່ໄດ້ ເພື່ອກັນຕັ້ງຄ່າຜິດແລ້ວລັອກຕົນເອງອອກ
        </p>
      )}
    </li>
  );
}
