// Suspense fallback ຂອງທຸກໜ້າໃນກຸ່ມ (app) — ສະແດງຕອນປ່ຽນໜ້າ ຂະນະໂຫຼດຂໍ້ມູນ
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <span className="sr-only">ກຳລັງໂຫຼດ...</span>

      {/* ຫົວຂໍ້ */}
      <div className="mb-2 h-7 w-56 rounded bg-slate-200" />
      <div className="mb-6 h-4 w-80 rounded bg-slate-100" />

      {/* ແຖບຄົ້ນຫາ / ຕົວກັ່ນຕອງ */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="h-10 w-72 rounded-lg bg-slate-100" />
        <div className="h-10 w-40 rounded-lg bg-slate-100" />
        <div className="h-10 w-40 rounded-lg bg-slate-100" />
      </div>

      {/* ຕາຕະລາງ */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-11 bg-slate-100" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-border px-4 py-3.5"
          >
            <div className="h-4 w-10 rounded bg-slate-100" />
            <div className="h-4 flex-1 rounded bg-slate-100" />
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
