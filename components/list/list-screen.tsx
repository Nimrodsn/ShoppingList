"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddBar } from "@/components/list/add-bar";
import { CategoryGroup } from "@/components/list/category-group";
import { CheckedSection } from "@/components/list/checked-section";
import { EmptyList } from "@/components/list/empty-list";
import { ItemSheet } from "@/components/list/item-sheet";
import { SearchSheet } from "@/components/list/search-sheet";
import {
  applyMutation,
  applyMutations,
  groupItems,
  isOptimisticId,
  type BoardMutation,
} from "@/lib/board";
import { NOT_SYNCED_YET, useOfflineQueue } from "@/lib/offline/provider";
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
  const queue = useOfflineQueue();

  // `useOptimistic` is the 0ms online path; the offline log is what survives a reload.
  const [sent, mutate] = useOptimistic<BoardItem[], BoardMutation>(
    board.items,
    applyMutation,
  );

  const items = useMemo(
    () => applyMutations(sent, queue.pendingMutations),
    [sent, queue.pendingMutations],
  );

  const grouped = useMemo(
    () => groupItems(items, board.categories),
    [items, board.categories],
  );

  function handleToggle(item: BoardItem) {
    if (isOptimisticId(item.id)) {
      toast.info(NOT_SYNCED_YET);
      return;
    }

    const isChecked = !item.isChecked;
    const clientId = crypto.randomUUID();
    const mutation: BoardMutation = {
      type: "toggle",
      itemId: item.id,
      isChecked,
      by: memberName,
    };

    startTransition(async () => {
      mutate(mutation);

      const result = await queue.run({
        clientId,
        kind: "toggle",
        input: { clientId, itemId: item.id, isChecked },
        optimistic: [mutation],
      });

      if (result === "failed") {
        toast.error("לא הצלחנו לעדכן את הפריט.");
        return;
      }

      if (result === "queued" || !isChecked) return;

      // Undo targets the item id, so it works even when another open item shares the name.
      toast.success(`${item.name} נלקח`, {
        duration: UNDO_DURATION,
        action: {
          label: "בטל",
          onClick: () => {
            const undoId = crypto.randomUUID();
            const undo: BoardMutation = {
              type: "toggle",
              itemId: item.id,
              isChecked: false,
              by: null,
            };

            startTransition(async () => {
              mutate(undo);
              await queue.run({
                clientId: undoId,
                kind: "toggle",
                input: { clientId: undoId, itemId: item.id, isChecked: false },
                optimistic: [undo],
              });
            });
          },
        },
      });
    });
  }

  function handleDelete(item: BoardItem) {
    startTransition(async () => {
      mutate({ type: "delete", itemId: item.id });

      // An item that never reached the server is deleted by dropping its queued add.
      if (isOptimisticId(item.id)) {
        await queue.dropQueuedItem(item.id);
        toast(`${item.name} נמחק`);
        return;
      }

      const result = await queue.run({
        clientId: crypto.randomUUID(),
        kind: "delete",
        input: { itemId: item.id },
        optimistic: [{ type: "delete", itemId: item.id }],
      });

      if (result === "failed") {
        toast.error("לא הצלחנו למחוק את הפריט.");
        return;
      }

      toast(`${item.name} נמחק`, {
        duration: UNDO_DURATION,
        action: {
          label: "בטל",
          onClick: () => {
            const restoreId = crypto.randomUUID();

            startTransition(async () => {
              mutate({ type: "add", item });
              await queue.run({
                clientId: restoreId,
                kind: "restore",
                input: {
                  clientId: restoreId,
                  listId: board.activeListId,
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  note: item.note,
                  isUrgent: item.isUrgent,
                  categoryId: item.categoryId,
                },
                optimistic: [{ type: "add", item }],
              });
            });
          },
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
