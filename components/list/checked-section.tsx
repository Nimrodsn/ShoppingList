"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { BoardItem } from "@/actions/queries";
import { ItemRow } from "@/components/list/item-row";
import { cn } from "@/lib/utils";

export function CheckedSection({
  items,
  onToggle,
  onDelete,
  onEdit,
}: {
  items: BoardItem[];
  onToggle: (item: BoardItem) => void;
  onDelete: (item: BoardItem) => void;
  onEdit: (item: BoardItem) => void;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <section className="space-y-2 pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
        נלקחו
        <span dir="ltr" className="tabular-nums font-normal">
          {items.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            className="space-y-2 overflow-hidden"
          >
            {items.map((item) => (
              <li key={item.id}>
                <ItemRow
                  item={item}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
