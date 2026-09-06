"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteItem, restoreItem, toggleItem } from "@/actions/items";
import { AddBar } from "@/components/list/add-bar";
import { CategoryGroup } from "@/components/list/category-group";
import { CheckedSection } from "@/components/list/checked-section";
import { EmptyList } from "@/components/list/empty-list";
import { ItemSheet } from "@/components/list/item-sheet";
import { SearchSheet } from "@/components/list/search-sheet";
import { applyMutation, groupItems, type BoardMutation } from "@/lib/board";
import type { Board, BoardItem } from "@/types/board";

const UNDO_DURATION = 6000;

export function ListScreen({
  board,
  memberName,
  stapleNames,
}: {
  board: Board;
  memberName: string;
  stapleNames: string[];
}) {
  const stapleNorms = useMemo(() => new Set(stapleNames), [stapleNames]);
  const [editing, setEditing] = useState<BoardItem | null>(null);
  const [, startTransition] = useTransition();

  // The 0ms online path only. Offline durability comes from the IndexedDB log.
  const [items, mutate] = useOptimistic<BoardItem[], BoardMutation>(
    board.items,
    applyMutation,
  );

  const grouped = useMemo(
    () => groupItems(items, board.categories),
    [items, board.categories],
  );

  function handleToggle(item: BoardItem) {
    const isChecked = !item.isChecked;

    startTransition(async () => {
      mutate({ type: "toggle", itemId: item.id, isChecked, by: memberName });

      try {
        await toggleItem({
          clientId: crypto.randomUUID(),
          itemId: item.id,
          isChecked,
        });
      } catch {
        toast.error("לא הצלחנו לעדכן את הפריט.");
        return;
      }

      if (!isChecked) return;

      // Undo targets the item id, so it works even when another open item shares the name.
      toast.success(`${item.name} נלקח`, {
        duration: UNDO_DURATION,
        action: {
          label: "בטל",
          onClick: () =>
            startTransition(async () => {
              mutate({
                type: "toggle",
                itemId: item.id,
                isChecked: false,
                by: null,
              });
              await toggleItem({
                clientId: crypto.randomUUID(),
                itemId: item.id,
                isChecked: false,
              });
            }),
        },
      });
    });
  }

  function handleDelete(item: BoardItem) {
    startTransition(async () => {
      mutate({ type: "delete", itemId: item.id });

      try {
        await deleteItem({ itemId: item.id });
      } catch {
        toast.error("לא הצלחנו למחוק את הפריט.");
        return;
      }

      toast(`${item.name} נמחק`, {
        duration: UNDO_DURATION,
        action: {
          label: "בטל",
          onClick: () =>
            startTransition(async () => {
              mutate({ type: "add", item });
              await restoreItem({
                clientId: crypto.randomUUID(),
                listId: board.activeListId,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                note: item.note,
                isUrgent: item.isUrgent,
                categoryId: item.categoryId,
              });
            }),
        },
      });
    });
  }

  return (
    <>
      <div className="flex justify-end px-4">
        <SearchSheet items={items} onSelect={setEditing} />
      </div>

      <div className="flex-1 space-y-4 px-4 pb-40">
        {grouped.openCount === 0 ? (
          <EmptyList hasChecked={grouped.checkedCount > 0} />
        ) : (
          <>
            {grouped.urgent.length > 0 ? (
              <CategoryGroup
                group={{
                  id: "urgent",
                  key: "urgent",
                  name: "דחוף",
                  emoji: "⚡",
                  items: grouped.urgent,
                }}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditing}
              />
            ) : null}

            {grouped.groups.map((group) => (
              <CategoryGroup
                key={group.id}
                group={group}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditing}
              />
            ))}
          </>
        )}

        <CheckedSection
          items={grouped.checked}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={setEditing}
        />
      </div>

      <div className="sticky bottom-0 z-20 space-y-2 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur">
        {grouped.openCount > 0 ? (
          <Button asChild variant="secondary" className="h-11 w-full">
            <Link href={`/shop?list=${board.activeListId}`}>
              <ShoppingCart className="size-4" aria-hidden />
              מצב קנייה
            </Link>
          </Button>
        ) : null}

        <AddBar
          listId={board.activeListId}
          categories={board.categories}
          items={items}
          memberName={memberName}
          mutate={mutate}
        />
      </div>

      <ItemSheet
        item={editing}
        categories={board.categories}
        stapleNames={stapleNorms}
        onClose={() => setEditing(null)}
        onDelete={handleDelete}
      />
    </>
  );
}
