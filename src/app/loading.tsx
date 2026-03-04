export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--brand-50)_0%,#ffffff_100%)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="h-14 animate-pulse rounded-2xl bg-brand-100" />
        <div className="h-40 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-brand-100" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-32 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-brand-100" />
          <div className="h-32 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-brand-100" />
        </div>
        <div className="h-56 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-brand-100" />
      </div>
    </div>
  );
}
