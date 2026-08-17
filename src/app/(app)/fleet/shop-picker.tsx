"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/ui";

type Shop = { code: string; name: string; phone?: string | null; address?: string | null };

/** ເລືອກຮ້ານຄ້າ/ລູກຄ້າ ຈາກ ar_customer ແບບຄົ້ນຫາ (typeahead, ຫຼາຍຮ້ານ).
 *  submit ເປັນ hidden input name="shop" value="code|name" ຕໍ່ຮ້ານ. */
export function ShopPicker({ name = "shop" }: { name?: string }) {
  const [selected, setSelected] = useState<Shop[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Shop[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) { setResults([]); setLoading(false); setErr(null); return; }
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
        if (!res.ok) { setErr(`ຄົ້ນຫາບໍ່ໄດ້ (${res.status}) — restart dev server?`); setResults([]); return; }
        const data = await res.json();
        setResults(Array.isArray(data.items) ? data.items : []);
      } catch { setErr("ຄົ້ນຫາບໍ່ໄດ້ — ກວດ /api/customers/search"); setResults([]); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const add = (shop: Shop) => {
    if (!selected.some((s) => s.code === shop.code)) setSelected((v) => [...v, shop]);
    setQuery(""); setResults([]); setOpen(false);
  };
  const remove = (code: string) => setSelected((v) => v.filter((s) => s.code !== code));

  return (
    <div ref={boxRef} className="relative">
      {selected.map((s) => (
        <input key={s.code} type="hidden" name={name} value={`${s.code}|${s.name}`} />
      ))}

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((s, i) => (
            <span key={s.code} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <span className="font-medium">{i + 1}.</span> {s.name}
              <button type="button" onClick={() => remove(s.code)} className="text-primary/60 hover:text-primary">×</button>
            </span>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="ພິມຄົ້ນຫາ ຊື່/ລະຫັດ/ເບີໂທ ຮ້ານຄ້າ..."
        className={inputClass}
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
          {loading && <p className="px-3 py-2 text-xs text-muted">ກຳລັງຄົ້ນຫາ...</p>}
          {err && <p className="px-3 py-2 text-xs text-rose-600">{err}</p>}
          {!loading && !err && results.length === 0 && <p className="px-3 py-2 text-xs text-muted">ບໍ່ພົບຮ້ານຄ້າ</p>}
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => add(r)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/8"
            >
              <span className="font-medium">{r.name}</span>
              <span className="block text-xs text-muted">{r.code}{r.phone ? ` · ${r.phone}` : ""}{r.address ? ` · ${r.address}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
