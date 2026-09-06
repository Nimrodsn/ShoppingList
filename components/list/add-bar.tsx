"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addItem, bulkAdd } from "@/actions/items";
import { matchCatalog, type CatalogSuggestion } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { parseQuantity, splitBulkInput } from "@/lib/hebrew";
import { tap } from "@/lib/haptics";

export function AddBar({ listId }: { listId: string }) {
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

  // Derived during render, which keeps stale results from a previous query off screen
  // without clearing state from inside the effect.
  const suggestions = shouldSuggest && matched.query === query ? matched.items : [];

  useEffect(() => {
    if (!shouldSuggest) return;

    let active = true;
    void matchCatalog(parseQuantity(query).name || query).then((items) => {
      if (active) setMatched({ query, items });
    });

    return () => {
      active = false;
    };
  }, [query, shouldSuggest]);

  function submit(rawText: string) {
    const text = rawText.trim();
    if (!text) return;

    setValue("");
    inputRef.current?.focus();

    const chunks = splitBulkInput(text);

    startTransition(async () => {
      try {
        if (chunks.length > 1) {
          const summary = await bulkAdd({ listId, raw: text });
          const parts = [`נוספו ${summary.added}`];
          if (summary.merged > 0) parts.push(`אוחדו ${summary.merged}`);
          if (summary.failed > 0) parts.push(`נכשלו ${summary.failed}`);
          toast.success(parts.join(", "));
          return;
        }

        const { name, quantity, unit } = parseQuantity(text);
        const result = await addItem({
          clientId: crypto.randomUUID(),
          listId,
          name: name || text,
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
