"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createList, deleteList, renameList, restoreList } from "@/actions/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListSummary } from "@/types/board";

const UNDO_DURATION = 6000;

export function ListsManager({ lists }: { lists: ListSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [newName, setNewName] = useState("");

  function add() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");

    startTransition(async () => {
      try {
        await createList({ name, emoji: "🛒" });
        router.refresh();
      } catch {
        toast.error("לא הצלחנו ליצור את הרשימה.");
      }
    });
  }

  function rename(listId: string) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name) return;

    startTransition(async () => {
      try {
        await renameList({ listId, name });
        router.refresh();
      } catch {
        toast.error("לא הצלחנו לשנות את השם.");
      }
    });
  }

  function remove(list: ListSummary) {
    startTransition(async () => {
      try {
        const snapshot = await deleteList(list.id);
        router.refresh();

        toast(`הרשימה ${list.name} נמחקה`, {
          duration: UNDO_DURATION,
          action: {
            label: "בטל",
            onClick: () =>
              startTransition(async () => {
                await restoreList(snapshot);
                router.refresh();
              }),
          },
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "לא הצלחנו למחוק את הרשימה.",
        );
      }
    });
  }

  return (
    <section aria-labelledby="lists-title" className="space-y-3">
      <h2 id="lists-title" className="font-heading text-lg font-semibold">
        הרשימות
      </h2>

      <ul className="space-y-2">
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex min-h-14 items-center gap-2 rounded-2xl border bg-card px-3"
          >
            <span aria-hidden>{list.emoji}</span>

            {editingId === list.id ? (
              <>
                <Input
                  autoFocus
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  maxLength={30}
                  aria-label={`שם חדש ל${list.name}`}
                  className="h-11 flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-11 shrink-0"
                  onClick={() => rename(list.id)}
                  aria-label="שמירת השם"
                >
                  <Check className="size-4" aria-hidden />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate font-medium">{list.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(list.id);
                    setDraftName(list.name);
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
                  aria-label={`שינוי שם ל${list.name}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => remove(list)}
                  disabled={lists.length <= 1 || isPending}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-destructive disabled:opacity-40"
                  aria-label={`מחיקת ${list.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={30}
          placeholder="רשימה חדשה"
          aria-label="שם הרשימה החדשה"
          className="h-12 text-base"
        />
        <Button
          type="submit"
          size="icon"
          className="size-12 shrink-0"
          disabled={isPending || newName.trim().length === 0}
          aria-label="הוספת רשימה"
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
        </Button>
      </form>
    </section>
  );
}
