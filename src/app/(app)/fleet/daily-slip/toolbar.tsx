"use client";

import { useRouter } from "next/navigation";

export default function SlipToolbar({ date }: { date: string }) {
  const router = useRouter();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">ວັນທີ</span>
        <input
          type="date"
          defaultValue={date}
          onChange={(e) => e.target.value && router.push(`/fleet/daily-slip?date=${e.target.value}`)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        🖨 ພິມໃບນຳໃຊ້ລົດ
      </button>
    </div>
  );
}
