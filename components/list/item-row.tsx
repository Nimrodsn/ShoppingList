"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Pencil, Trash2, Zap } from "lucide-react";
import type { BoardItem } from "@/types/board";
import { Checkbox } from "@/components/ui/checkbox";
import { formatQuantityWithUnit, initials, timeAgo } from "@/lib/format";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 80;

export type ItemRowProps = {
  item: BoardItem;
  onToggle: (item: BoardItem) => void;
  onDelete: (item: BoardItem) => void;
  onEdit: (item: BoardItem) => void;
  large?: boolean;
};

export function ItemRow({ item, onToggle, onDelete, onEdit, large }: ItemRowProps) {
  const reduceMotion = useReducedMotion();
  const amount = formatQuantityWithUnit(item.quantity, item.unit);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe affordances sit behind the row: end side deletes, start side takes. */}
      <div className="absolute inset-0 flex items-center justify-between px-5">
        <span className="flex items-center gap-2 text-sm font-medium text-destructive">
          <Trash2 className="size-5" aria-hidden />
          מחיקה
        </span>
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Check className="size-5" aria-hidden />
          נלקח
        </span>
      </div>

      <motion.div
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        dragSnapToOrigin
        onDragEnd={(_event, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD) {
            tap(15);
            onDelete(item);
          } else if (info.offset.x > SWIPE_THRESHOLD) {
            tap();
            onToggle(item);
          }
        }}
        className="relative bg-card"
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border bg-card px-3 py-2",
            large ? "min-h-16" : "min-h-14",
            item.isUrgent && "border-urgent/60 bg-urgent/5",
          )}
        >
          <label
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center"
            aria-label={item.isChecked ? `בטל סימון ${item.name}` : `סמן ${item.name} כנלקח`}
          >
            <Checkbox
              checked={item.isChecked}
              onCheckedChange={() => {
                tap();
                onToggle(item);
              }}
              className="size-6"
            />
          </label>

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="min-w-0 flex-1 text-start"
          >
            <span className="flex items-center gap-2">
              {item.isUrgent ? (
                <Zap className="size-4 shrink-0 text-urgent" aria-label="דחוף" />
              ) : null}
              <span
                className={cn(
                  "truncate font-medium",
                  large ? "text-lg" : "text-base",
                  item.isChecked && "text-muted-foreground line-through",
                )}
              >
                {item.name}
              </span>
              {amount ? (
                <span
                  dir="ltr"
                  className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-secondary-foreground"
                >
                  {amount}
                </span>
              ) : null}
            </span>

            {item.note || item.addedBy ? (
              <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {item.note ? <span className="truncate">{item.note}</span> : null}
                {item.addedBy ? (
                  <span className="shrink-0">
                    נוסף ע״י {item.addedBy}, {timeAgo(item.createdAt)}
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>

          {item.addedBy ? (
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
            >
              {initials(item.addedBy)}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
            aria-label={`עריכת ${item.name}`}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
