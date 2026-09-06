"use client";

import Link from "next/link";
import type { ListSummary } from "@/actions/queries";
import { cn } from "@/lib/utils";

export function ListTabs({
  lists,
  activeListId,
}: {
  lists: ListSummary[];
  activeListId: string;
}) {
  if (lists.length <= 1) return null;

  return (
    <nav aria-label="רשימות" className="flex gap-2 overflow-x-auto px-4 pb-2">
      {lists.map((list) => {
        const isActive = list.id === activeListId;
        return (
          <Link
            key={list.id}
            href={`/?list=${list.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium",
              isActive ? "border-primary bg-primary/10 text-foreground" : "bg-card",
            )}
          >
            <span aria-hidden>{list.emoji}</span>
            {list.name}
            {list.openCount > 0 ? (
              <span dir="ltr" className="tabular-nums text-xs text-muted-foreground">
                {list.openCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
