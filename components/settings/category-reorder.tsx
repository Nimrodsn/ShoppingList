"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { reorderCategories } from "@/actions/categories";
import type { CategoryRef } from "@/types/board";
import { tap } from "@/lib/haptics";

function SortableRow({ category }: { category: CategoryRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3"
      data-dragging={isDragging}
    >
      <button
        type="button"
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-muted-foreground"
        aria-label={`שינוי מקום של ${category.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <span aria-hidden>{category.emoji}</span>
      <span className="flex-1 truncate font-medium">{category.name}</span>
    </li>
  );
}

/** The aisle order of the family's supermarket. Keyboard reordering works too. */
export function CategoryReorder({ categories }: { categories: CategoryRef[] }) {
  const [order, setOrder] = useState(categories);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.findIndex((category) => category.id === active.id);
    const to = order.findIndex((category) => category.id === over.id);
    if (from === -1 || to === -1) return;

    const next = arrayMove(order, from, to);
    setOrder(next);
    tap();

    startTransition(async () => {
      try {
        await reorderCategories({ orderedIds: next.map((category) => category.id) });
      } catch {
        setOrder(order);
        toast.error("לא הצלחנו לשמור את הסדר.");
      }
    });
  }

  return (
    <section aria-labelledby="order-title" className="space-y-3">
      <div>
        <h2 id="order-title" className="font-heading text-lg font-semibold">
          סדר המדפים
        </h2>
        <p className="text-sm text-muted-foreground">
          סדרו את הקטגוריות לפי המסלול שלכם בסופר. הרשימה תופיע באותו סדר.
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={order.map((category) => category.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {order.map((category) => (
              <SortableRow key={category.id} category={category} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}
