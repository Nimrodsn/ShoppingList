import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/auth/household";
import { getHistory } from "@/actions/suggestions";
import { PageHeader } from "@/components/shared/page-header";
import { formatQuantityWithUnit, timeAgo } from "@/lib/format";

export default async function HistoryPage() {
  const household = await getHousehold();
  if (!household) redirect("/");

  const { entries, top } = await getHistory();

  if (entries.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <PageHeader title="היסטוריה" />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="text-5xl" aria-hidden>
            🧾
          </span>
          <p className="font-heading text-lg font-semibold">עוד לא נסגרה קנייה</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            בסוף הקנייה הבאה, כל מה שסימנתם יישמר כאן.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <PageHeader title="היסטוריה" subtitle={`${entries.length} קניות אחרונות`} />

      <main className="space-y-6 px-4 pb-10">
        {top.length > 0 ? (
          <section aria-labelledby="top-products">
            <h2 id="top-products" className="mb-2 text-sm font-semibold">
              מה קונים הרבה
            </h2>
            <ul className="flex flex-wrap gap-2">
              {top.map((stat) => (
                <li
                  key={stat.name}
                  className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm"
                >
                  {stat.name}
                  <span dir="ltr" className="tabular-nums text-muted-foreground">
                    ×{stat.purchases}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="all-purchases">
          <h2 id="all-purchases" className="mb-2 text-sm font-semibold">
            כל הקניות
          </h2>
          <ul className="space-y-2">
            {entries.map((entry) => {
              const amount = formatQuantityWithUnit(entry.quantity, entry.unit);
              return (
                <li
                  key={entry.id}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entry.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {timeAgo(entry.purchasedAt)}
                      {entry.purchasedBy ? ` · ${entry.purchasedBy}` : ""}
                    </span>
                  </span>
                  {amount ? (
                    <span
                      dir="ltr"
                      className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums"
                    >
                      {amount}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
