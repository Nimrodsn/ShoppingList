"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Mic, MicOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { matchCatalog, type CatalogSuggestion } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { findOpenByNorm, optimisticId, type BoardMutation } from "@/lib/board";
import { normalizeHebrew, parseQuantity, splitBulkInput } from "@/lib/hebrew";
import { tap } from "@/lib/haptics";
import { useOfflineQueue } from "@/lib/offline/provider";
import type { QueuedMutation } from "@/lib/offline/queue";
import type { BoardItem, CategoryRef } from "@/types/board";

const OFFLINE_NOTICE = "אין חיבור. נשלח את זה ברגע שהוא יחזור.";

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
  const queue = useOfflineQueue();

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

  // `submit` is a hoisted function declaration, so it is safe to reference here.
  const speech = useSpeechInput((transcript) => submit(transcript));

  /** Mirrors the server's merge rule, so the row on screen matches what lands in the DB. */
  function buildMutation(
    name: string,
    quantity: number | null,
    unit: string | null,
  ): BoardMutation {
    const existing = findOpenByNorm(items, normalizeHebrew(name), normalizeHebrew);

    if (existing) {
      return {
        type: "mergeQuantity",
        itemId: existing.id,
        quantity: (existing.quantity ?? 1) + (quantity ?? 1),
      };
    }

    const suggestion = suggestions.find(
      (entry) => normalizeHebrew(entry.name) === normalizeHebrew(name),
    );
    const category = suggestion
      ? categories.find((entry) => entry.key === suggestion.categoryKey)
      : undefined;
    const now = new Date().toISOString();

    return {
      type: "add",
      item: {
        id: optimisticId(),
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
    };
  }

  function addEntry(
    name: string,
    quantity: number | null,
    unit: string | null,
  ): QueuedMutation {
    const clientId = crypto.randomUUID();

    return {
      clientId,
      kind: "add",
      input: { clientId, listId, name, quantity, unit },
      optimistic: [buildMutation(name, quantity, unit)],
    };
  }

  async function submitOne(text: string) {
    const { name, quantity, unit } = parseQuantity(text);
    const entry = addEntry(name || text, quantity, unit);
    const [mutation] = entry.optimistic;

    mutate(mutation);

    const result = await queue.run(entry);

    if (result === "failed") {
      toast.error("לא הצלחנו להוסיף. נסו שוב.");
      return;
    }

    if (result === "queued") {
      toast.info(OFFLINE_NOTICE);
      return;
    }

    if (mutation.type === "mergeQuantity") {
      toast.success(`עדכנתי ל-${mutation.quantity} ${name || text}`);
      return;
    }

    tap();
  }

  async function submitBulk(text: string, chunks: string[]) {
    const parsed = chunks
      .map((chunk) => parseQuantity(chunk))
      .filter((chunk) => chunk.name.length > 0);

    const entries = parsed.map((chunk) =>
      addEntry(chunk.name, chunk.quantity, chunk.unit),
    );

    for (const entry of entries) mutate(entry.optimistic[0]);

    const bulkId = crypto.randomUUID();
    const result = await queue.run({
      clientId: bulkId,
      kind: "bulkAdd",
      input: { listId, raw: text },
      optimistic: entries.flatMap((entry) => entry.optimistic),
    });

    if (result === "failed") {
      toast.error("לא הצלחנו להוסיף. נסו שוב.");
      return;
    }

    if (result === "queued") {
      // One bulk statement is not idempotent on the server, so a retry has to go
      // item by item, each with its own clientId.
      await queue.replace(bulkId, entries);
      toast.info(OFFLINE_NOTICE);
      return;
    }

    const merged = entries.filter(
      (entry) => entry.optimistic[0].type === "mergeQuantity",
    ).length;
    const added = entries.length - merged;

    const parts = [`נוספו ${added}`];
    if (merged > 0) parts.push(`אוחדו ${merged}`);
    toast.success(parts.join(", "));
  }

  function submit(rawText: string) {
    const text = rawText.trim();
    if (!text) return;

    setValue("");
    inputRef.current?.focus();

    const chunks = splitBulkInput(text);

    startTransition(async () => {
      if (chunks.length > 1) await submitBulk(text, chunks);
      else await submitOne(text);
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
          type="button"
          variant="outline"
          size="icon"
          className="size-12 shrink-0"
          aria-label={speech.isListening ? "עצירת הכתבה" : "הוספה בדיבור"}
          aria-pressed={speech.isListening}
          onClick={() => {
            if (!speech.toggle()) {
              toast.info("הדפדפן הזה לא תומך בהכתבה קולית.");
            }
          }}
        >
          {speech.isListening ? (
            <MicOff className="size-5 text-destructive" aria-hidden />
          ) : (
            <Mic className="size-5" aria-hidden />
          )}
        </Button>

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
