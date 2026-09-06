"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQuantityWithUnit } from "@/lib/format";
import { normalizeHebrew } from "@/lib/hebrew";
import type { BoardItem } from "@/types/board";

/**
 * Search inside the current list. Runs entirely on already-loaded data, so it keeps
 * working offline and answers instantly while typing.
 */
export function SearchSheet({
  items,
  onSelect,
}: {
  items: BoardItem[];
  onSelect: (item: BoardItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const norm = normalizeHebrew(query);
    if (norm.length === 0) return [];
    return items.filter((item) => normalizeHebrew(item.name).includes(norm));
  }, [items, query]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Drawer.Trigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label="חיפוש ברשימה">
          <Search className="size-5" aria-hidden />
        </Button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          dir="rtl"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border bg-card p-4 pb-safe"
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" aria-hidden />
          <Drawer.Title className="mb-3 font-heading text-lg font-bold">
            חיפוש ברשימה
          </Drawer.Title>

          <div className="flex gap-2">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="מה מחפשים?"
              aria-label="מה מחפשים"
              className="h-12 text-base"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-12 shrink-0"
                onClick={() => setQuery("")}
                aria-label="ניקוי החיפוש"
              >
                <X className="size-5" aria-hidden />
              </Button>
            ) : null}
          </div>

          <div className="mt-3 flex-1 overflow-y-auto">
            {query && results.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                לא נמצא כלום ברשימה הזו.
              </p>
            ) : (
              <ul className="space-y-2">
                {results.map((item) => {
                  const amount = formatQuantityWithUnit(item.quantity, item.unit);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setQuery("");
                          onSelect(item);
                        }}
                        className="flex min-h-14 w-full items-center gap-2 rounded-2xl border bg-background px-3 text-start"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.name}
                        </span>
                        {amount ? (
                          <span
                            dir="ltr"
                            className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums"
                          >
                            {amount}
                          </span>
                        ) : null}
                        {item.isChecked ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            נלקח
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
