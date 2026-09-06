"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBasket, Star } from "lucide-react";
import { toast } from "sonner";
import { addStaples, setStaple } from "@/actions/trip";
import type { CatalogSuggestion } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CategoryRef } from "@/types/board";
import { cn } from "@/lib/utils";

export function StaplesScreen({
  staples,
  categories,
  listId,
}: {
  staples: CatalogSuggestion[];
  categories: CategoryRef[];
  listId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(staples.map((entry) => entry.id)),
  );

  const byKey = new Map(categories.map((category) => [category.key, category]));
  const groups = categories
    .map((category) => ({
      category,
      entries: staples.filter((entry) => entry.categoryKey === category.key),
    }))
    .filter((group) => group.entries.length > 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    const ids = [...selected];
    if (ids.length === 0) return;

    startTransition(async () => {
      try {
        const summary = await addStaples({ listId, catalogItemIds: ids });
        toast.success(
          summary.merged > 0
            ? `נוספו ${summary.added}, אוחדו ${summary.merged}`
            : `נוספו ${summary.added} פריטים`,
        );
        router.push("/");
      } catch {
        toast.error("לא הצלחנו להוסיף את הקנייה השבועית.");
      }
    });
  }

  if (staples.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="text-5xl" aria-hidden>
          ⭐
        </span>
        <p className="font-heading text-lg font-semibold">אין עוד קנייה שבועית</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          סמנו פריטים בכוכב מתוך הרשימה, והם יופיעו כאן להוספה בלחיצה אחת.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 space-y-5 px-4 pb-40">
        {groups.map(({ category, entries }) => (
          <section key={category.key} aria-labelledby={`staple-${category.key}`}>
            <h2
              id={`staple-${category.key}`}
              className="mb-2 flex items-center gap-2 text-sm font-semibold"
            >
              <span aria-hidden>{byKey.get(category.key)?.emoji ?? "🛒"}</span>
              {category.name}
            </h2>
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <div
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3",
                      selected.has(entry.id) && "border-primary/60 bg-primary/5",
                    )}
                  >
                    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                      <Checkbox
                        checked={selected.has(entry.id)}
                        onCheckedChange={() => toggle(entry.id)}
                        className="size-6"
                        aria-label={`בחירת ${entry.name}`}
                      />
                    </label>
                    <span className="flex-1 truncate font-medium">
                      {entry.emoji ? <span aria-hidden>{entry.emoji} </span> : null}
                      {entry.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await setStaple(entry.name, false);
                            router.refresh();
                          } catch {
                            toast.error("לא הצלחנו לעדכן את הקנייה השבועית.");
                          }
                        })
                      }
                      className="grid size-11 shrink-0 place-items-center rounded-full text-urgent"
                      aria-label={`הסרת ${entry.name} מהקנייה השבועית`}
                    >
                      <Star className="size-5 fill-current" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur">
        <Button
          type="button"
          onClick={add}
          disabled={isPending || selected.size === 0}
          className="h-14 w-full text-base"
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <ShoppingBasket className="size-5" aria-hidden />
          )}
          הוספת {selected.size} פריטים לרשימה
        </Button>
      </div>
    </>
  );
}
