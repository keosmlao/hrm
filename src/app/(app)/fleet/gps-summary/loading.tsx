export default function GpsSummaryLoading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#063b3b] to-[#07584f] px-6 py-6 text-white">
        <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-white/15" />
        <p className="mt-3 text-sm text-emerald-50/80">
          ກຳລັງດຶງຜົນສະຫຼຸບຈາກ LaoGPS… ການເປີດຄັ້ງຕໍ່ໄປຈະໄວຂຶ້ນ
        </p>
      </section>

      <section className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="mt-4 h-7 w-32 rounded bg-slate-200" />
            <div className="mt-3 h-2.5 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </section>

      <section className="animate-pulse overflow-hidden rounded-xl border border-border bg-card" aria-hidden="true">
        <div className="h-16 border-b border-border bg-slate-50" />
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="flex gap-5 border-b border-border px-4 py-4">
            <div className="h-4 w-8 rounded bg-slate-100" />
            <div className="h-4 w-48 rounded bg-slate-100" />
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-4 flex-1 rounded bg-slate-50" />
          </div>
        ))}
      </section>
    </div>
  );
}
