"use client";

/** ປຸ່ມພິມແຜນການປະຈຳເດືອນ — ແຍກເປັນ client component ເພາະໜ້າຫຼັກເປັນ server */
export default function PlanToolbar() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </svg>
      ພິມແຜນການ
    </button>
  );
}
