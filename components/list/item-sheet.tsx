"use client";

import { Drawer } from "vaul";
import type { BoardItem, CategoryRef } from "@/types/board";
import { ItemForm } from "@/components/list/item-form";
import { normalizeHebrew } from "@/lib/hebrew";

export function ItemSheet({
  item,
  categories,
  stapleNames,
  onClose,
  onDelete,
}: {
  item: BoardItem | null;
  categories: CategoryRef[];
  stapleNames: ReadonlySet<string>;
  onClose: () => void;
  onDelete: (item: BoardItem) => void;
}) {
  return (
    <Drawer.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          dir="rtl"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-card p-4 pb-safe"
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" aria-hidden />
          <Drawer.Title className="mb-4 font-heading text-lg font-bold">
            עריכת פריט
          </Drawer.Title>

          {/* Keyed by item id so the form state is initialized from props on open,
              instead of being synced back from an effect. */}
          {item ? (
            <ItemForm
              key={item.id}
              item={item}
              categories={categories}
              isKnownStaple={stapleNames.has(normalizeHebrew(item.name))}
              onClose={onClose}
              onDelete={onDelete}
            />
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
