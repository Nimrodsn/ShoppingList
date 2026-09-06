"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Board, BoardItem } from "@/actions/queries";
import { deleteItem, restoreItem, toggleItem } from "@/actions/items";
import { AddBar } from "@/components/list/add-bar";
import { CategoryGroup } from "@/components/list/category-group";
import { CheckedSection } from "@/components/list/checked-section";
import { EmptyList } from "@/components/list/empty-list";
import { ItemSheet } from "@/components/list/item-sheet";

const UNDO_DURATION = 6000;

export function ListScreen({ board }: { board: Board }) {
  const [editing, setEditing] = useState<BoardItem | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(item: BoardItem) {
    const next = !item.isChecked;

    startTransition(async () => {
      try {
        await toggleItem({
          clientId: crypto.randomUUID(),
          itemId: item.id,
          isChecked: next,
        });
      } catch {
        toast.error("לא הצלחנו לעדכן את הפריט.");
        return;
      }

      if (!next) return;

      // Undo targets the item id, so it works even when another open item shares the name.
      toast.success(`${item.name} נלקח`, {
        duration: UNDO_DURATION,
        action: {
          label: "בטל",
          onClick: () =>
            startTransition(async () => {
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

  const isEmpty = board.openCount === 0;

  return (
    <>
      <div className="flex-1 space-y-4 px-4 pb-40">
        {isEmpty ? (
          <EmptyList hasChecked={board.checkedCount > 0} />
        ) : (
          <>
            {board.urgent.length > 0 ? (
              <CategoryGroup
                group={{
                  id: "urgent",
                  key: "urgent",
                  name: "דחוף",
                  emoji: "⚡",
                  items: board.urgent,
                }}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditing}
              />
            ) : null}

            {board.groups.map((group) => (
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
          items={board.checked}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={setEditing}
        />
      </div>

      <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur">
        <AddBar listId={board.activeListId} />
      </div>

      <ItemSheet
        item={editing}
        categories={board.categories}
        onClose={() => setEditing(null)}
        onDelete={handleDelete}
      />
    </>
  );
}
