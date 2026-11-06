/** Shown instantly while the shopping screen's data loads. */
export default function ShopLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col" dir="rtl">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div className="size-11 animate-pulse rounded-full bg-muted" aria-hidden />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" aria-hidden />
        </div>
      </header>
      <div className="space-y-3 p-4" aria-label="טוען את מצב הקנייה">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-14 animate-pulse rounded-2xl border bg-muted/50"
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
