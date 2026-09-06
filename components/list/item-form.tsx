"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BoardItem, CategoryRef } from "@/actions/queries";
import { teachCategory } from "@/actions/catalog";
import { updateItem } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function ItemForm({
  item,
  categories,
  onClose,
  onDelete,
}: {
  item: BoardItem;
  categories: CategoryRef[];
  onClose: () => void;
  onDelete: (item: BoardItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(
    item.quantity === null ? "" : String(item.quantity),
  );
  const [unit, setUnit] = useState(item.unit ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [isUrgent, setIsUrgent] = useState(item.isUrgent);
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");

  function save() {
    const parsedQuantity = quantity.trim() === "" ? null : Number(quantity);
    const categoryChanged = categoryId !== (item.categoryId ?? "");
    const trimmedName = name.trim();

    startTransition(async () => {
      try {
        await updateItem({
          itemId: item.id,
          name: trimmedName,
          quantity:
            parsedQuantity !== null && Number.isFinite(parsedQuantity)
              ? parsedQuantity
              : null,
          unit: unit.trim() === "" ? null : unit.trim(),
          note: note.trim() === "" ? null : note.trim(),
          isUrgent,
          categoryId: categoryId === "" ? null : categoryId,
        });

        // A manual category correction teaches the household catalog for next time.
        if (categoryChanged && categoryId) {
          await teachCategory(trimmedName, categoryId);
        }

        onClose();
      } catch {
        toast.error("לא הצלחנו לשמור את השינויים.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="item-name">שם</Label>
        <Input
          id="item-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="item-quantity">כמות</Label>
          <Input
            id="item-quantity"
            dir="ltr"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="h-12 text-base tabular-nums"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="item-unit">יחידה</Label>
          <Input
            id="item-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-category">קטגוריה</Label>
        <select
          id="item-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="h-12 w-full rounded-lg border bg-background px-3 text-base"
        >
          <option value="">בלי קטגוריה</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.emoji} {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-note">הערה</Label>
        <Textarea
          id="item-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="text-base"
        />
      </div>

      <div className="flex min-h-11 items-center justify-between">
        <Label htmlFor="item-urgent">דחוף ⚡</Label>
        <Switch id="item-urgent" checked={isUrgent} onCheckedChange={setIsUrgent} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={save}
          disabled={isPending || name.trim().length === 0}
          className="h-12 flex-1 text-base"
        >
          {isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          שמירה
        </Button>
        <Button
          type="button"
          variant="outline"
          className="size-12 shrink-0 text-destructive"
          aria-label="מחיקת הפריט"
          onClick={() => {
            onClose();
            onDelete(item);
          }}
        >
          <Trash2 className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
