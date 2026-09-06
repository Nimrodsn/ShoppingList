"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addItem } from "@/actions/items";
import type { ForgottenSuggestion } from "@/actions/suggestions";

export function ForgottenBanner({
  suggestions,
  listId,
}: {
  suggestions: ForgottenSuggestion[];
  listId: string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = suggestions.filter((entry) => !dismissed.has(entry.name));
  if (visible.length === 0) return null;

  function add(suggestion: ForgottenSuggestion) {
    setDismissed((current) => new Set(current).add(suggestion.name));

    startTransition(async () => {
      try {
        await addItem({
          clientId: crypto.randomUUID(),
          listId,
          name: suggestion.name,
        });
      } catch {
        toast.error("לא הצלחנו להוסיף את הפריט.");
      }
    });
  }

  return (
    <section
      aria-labelledby="forgotten-title"
      className="mx-4 space-y-2 rounded-2xl border border-urgent/40 bg-urgent/5 p-3"
    >
      <h2 id="forgotten-title" className="text-sm font-semibold">
        🤔 אולי שכחתם?
      </h2>
      <ul className="space-y-1.5">
        {visible.map((suggestion) => (
          <li key={suggestion.name} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => add(suggestion)}
              disabled={isPending}
              className="flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-card px-3 text-start text-sm"
            >
              <Plus className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{suggestion.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {suggestion.reason}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setDismissed((current) => new Set(current).add(suggestion.name))
              }
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
              aria-label={`הסתרת ההצעה ${suggestion.name}`}
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
