"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { ArrowRight, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { closeTrip } from "@/actions/trip";
import { CategoryGroup } from "@/components/list/category-group";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRealtime } from "@/lib/realtime/provider";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  applyMutation,
  applyMutations,
  groupItems,
  isOptimisticId,
  type BoardMutation,
} from "@/lib/board";
import { NOT_SYNCED_YET, useOfflineQueue } from "@/lib/offline/provider";
import { tap } from "@/lib/haptics";
import type { Board, BoardItem } from "@/types/board";

export function ShoppingScreen({
  board,
  memberName,
}: {
  board: Board;
  memberName: string;
}) {
  const router = useRouter();
  const { setMode } = useRealtime();
  const [isPending, startTransition] = useTransition();
  const [isClosing, setIsClosing] = useState(false);

  const queue = useOfflineQueue();

  const [sent, mutate] = useOptimistic<BoardItem[], BoardMutation>(
    board.items,
    applyMutation,
  );

  // Aisles are where the signal dies, so the log carries the ticks until it returns.
  const items = useMemo(
    () => applyMutations(sent, queue.pendingMutations),
    [sent, queue.pendingMutations],
  );

  useWakeLock(true);

  useEffect(() => {
    setMode("shopping");
    return () => setMode("idle");
  }, [setMode]);

  const grouped = useMemo(
    () => groupItems(items, board.categories),
    [items, board.categories],
  );

  const total = grouped.openCount + grouped.checkedCount;
  const percent = total === 0 ? 0 : Math.round((grouped.checkedCount / total) * 100);

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
    tap();

    startTransition(async () => {
      mutate(mutation);

      const result = await queue.run({
        clientId,
        kind: "toggle",
        input: { clientId, itemId: item.id, isChecked },
        optimistic: [mutation],
      });

      if (result === "failed") toast.error("לא הצלחנו לעדכן את הפריט.");
    });
  }

  function finish() {
    // Closing archives the checked items, so it must never run over an unsynced tick.
    if (queue.pending.length > 0) {
      toast.info("יש שינויים שמחכים לחיבור. נסגור את הקנייה אחרי שהם יסונכרנו.");
      return;
    }

    setIsClosing(true);
    startTransition(async () => {
      try {
        const result = await closeTrip({ listId: board.activeListId });
        void confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
        toast.success(
          result.remaining > 0
            ? `נסגרו ${result.archived} פריטים. נשארו ${result.remaining} לפעם הבאה.`
            : `נסגרו ${result.archived} פריטים. הרשימה נקייה!`,
        );
        router.push("/");
      } catch {
        setIsClosing(false);
        toast.error("לא הצלחנו לסגור את הקנייה.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <header className="space-y-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href="/" aria-label="חזרה לרשימה">
              <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-xl font-bold">מצב קנייה</h1>
            <p dir="ltr" className="text-sm tabular-nums text-muted-foreground">
              {grouped.checkedCount}/{total}
            </p>
          </div>
        </div>
        <Progress value={percent} aria-label={`הושלמו ${percent} אחוזים`} />
      </header>

      <main className="flex-1 space-y-4 px-4 pt-4 pb-40">
        {grouped.openCount === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-5xl" aria-hidden>
              🎉
            </span>
            <p className="font-heading text-lg font-semibold">לקחתם הכל!</p>
            <p className="text-sm text-muted-foreground">
              אפשר לסגור את הקנייה ולשמור אותה בהיסטוריה.
            </p>
          </div>
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
                onDelete={() => {}}
                onEdit={() => {}}
                large
              />
            ) : null}

            {grouped.groups.map((group) => (
              <CategoryGroup
                key={group.id}
                group={group}
                onToggle={handleToggle}
                onDelete={() => {}}
                onEdit={() => {}}
                large
              />
            ))}
          </>
        )}
      </main>

      <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur">
        <Button
          type="button"
          onClick={finish}
          disabled={isPending || isClosing || grouped.checkedCount === 0}
          className="h-14 w-full text-base"
        >
          {isClosing ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <PartyPopper className="size-5" aria-hidden />
          )}
          סיימתי לקנות
        </Button>
      </div>
    </div>
  );
}
