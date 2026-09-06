"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addItem, bulkAdd } from "@/actions/items";
import { matchCatalog, type CatalogSuggestion } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { findOpenByNorm, type BoardMutation } from "@/lib/board";
import { normalizeHebrew, parseQuantity, splitBulkInput } from "@/lib/hebrew";
import { tap } from "@/lib/haptics";
import type { BoardItem, CategoryRef } from "@/types/board";

export function AddBar({
  listId,
  categories,
  items,
  memberName,
  mutate,
}: {
  listId: string;
  categories: CategoryRef[];
  items: BoardItem[];
  memberName: string;
  mutate: (mutation: BoardMutation) => void;
}) {
  const [value, setValue] = useState("");
  const [matched, setMatched] = useState<{
    query: string;
    items: CatalogSuggestion[];
  }>({ query: "", items: [] });
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useDebouncedValue(value.trim(), 150);

  // A multi-line or comma-separated paste is a bulk add, so suggestions are pointless.
  const shouldSuggest = query.length >= 2 && splitBulkInput(query).length <= 1;

  // Derived during render, which keeps results from a previous query off screen
  // without clearing state from inside the effect.
  const suggestions = shouldSuggest && matched.query === query ? matched.items : [];

  useEffect(() => {
    if (!shouldSuggest) return;

    let active = true;
    void matchCatalog(parseQuantity(query).name || query).then((results) => {
      if (active) setMatched({ query, items: results });
    });

    return () => {
      active = false;
    };
  }, [query, shouldSuggest]);

  /** Mirrors the server's merge rule so the optimistic row matches what lands in the DB. */
  function optimisticAdd(name: string, quantity: number | null, unit: string | null) {
    const existing = findOpenByNorm(items, normalizeHebrew(name), normalizeHebrew);

    if (existing) {
      mutate({
        type: "mergeQuantity",
        itemId: existing.id,
        quantity: (existing.quantity ?? 1) + (quantity ?? 1),
      });
      return;
    }

    const suggestion = suggestions.find(
      (entry) => normalizeHebrew(entry.name) === normalizeHebrew(name),
    );
    const category = suggestion
      ? categories.find((entry) => entry.key === suggestion.categoryKey)
      : undefined;
    const now = new Date().toISOString();

    mutate({
      type: "add",
      item: {
        id: `optimistic-${crypto.randomUUID()}`,
        name,
        quantity,
        unit: unit ?? suggestion?.defaultUnit ?? null,
        note: null,
        isChecked: false,
        isUrgent: false,
        position: 0,
        categoryId: category?.id ?? null,
        addedBy: memberName,
        checkedBy: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  function submit(rawText: string) {
    const text = rawText.trim();
    if (!text) return;

    setValue("");
    inputRef.current?.focus();

    const chunks = splitBulkInput(text);

    startTransition(async () => {
      try {
        if (chunks.length > 1) {
          for (const chunk of chunks) {
            const parsed = parseQuantity(chunk);
            if (parsed.name) optimisticAdd(parsed.name, parsed.quantity, parsed.unit);
          }

          const summary = await bulkAdd({ listId, raw: text });
          const parts = [`נוספו ${summary.added}`];
          if (summary.merged > 0) parts.push(`אוחדו ${summary.merged}`);
          if (summary.failed > 0) parts.push(`נכשלו ${summary.failed}`);
          toast.success(parts.join(", "));
          return;
        }

        const { name, quantity, unit } = parseQuantity(text);
        const finalName = name || text;
        optimisticAdd(finalName, quantity, unit);

        const result = await addItem({
          clientId: crypto.randomUUID(),
          listId,
          name: finalName,
          quantity,
          unit,
        });

        if (result.status === "merged") {
          toast.success(`עדכנתי ל-${result.quantity} ${result.name}`);
        } else if (result.status === "added") {
          tap();
        }
      } catch {
        toast.error("לא הצלחנו להוסיף. נסו שוב.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {suggestions.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="הצעות השלמה">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => submit(suggestion.name)}
                className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-4 text-sm"
              >
                {suggestion.emoji ? <span aria-hidden>{suggestion.emoji}</span> : null}
                {suggestion.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="flex gap-2"
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="מה להוסיף? אפשר גם להדביק כמה שורות"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="הוספת פריט"
          className="h-12 text-base"
        />
        <Button
          type="submit"
          size="icon"
          className="size-12 shrink-0"
          disabled={isPending || value.trim().length === 0}
          aria-label="הוספה"
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
        </Button>
      </form>
    </div>
  );
}
