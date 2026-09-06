"use client";

import { AnimatePresence, motion } from "motion/react";
import type { BoardItem, CategoryGroup as CategoryGroupData } from "@/actions/queries";
import { ItemRow } from "@/components/list/item-row";

export type CategoryGroupProps = {
  group: Pick<CategoryGroupData, "id" | "key" | "name" | "emoji"> & {
    items: BoardItem[];
  };
  onToggle: (item: BoardItem) => void;
  onDelete: (item: BoardItem) => void;
  onEdit: (item: BoardItem) => void;
  large?: boolean;
};

export function CategoryGroup({
  group,
  onToggle,
  onDelete,
  onEdit,
  large,
}: CategoryGroupProps) {
  return (
    <section aria-labelledby={`cat-${group.id}`} className="space-y-2">
      <h2
        id={`cat-${group.id}`}
        className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 py-2 text-sm font-semibold backdrop-blur"
        style={{ color: `var(--color-cat-${group.key}, var(--foreground))` }}
      >
        <span aria-hidden>{group.emoji}</span>
        <span className="text-foreground">{group.name}</span>
        <span dir="ltr" className="text-xs font-normal tabular-nums text-muted-foreground">
          {group.items.length}
        </span>
      </h2>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {group.items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            >
              <ItemRow
                item={item}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                large={large}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
