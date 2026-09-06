"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BoardMutation } from "@/lib/board";
import { sendMutation } from "@/lib/offline/dispatch";
import { isNetworkError } from "@/lib/offline/errors";
import {
  appendToQueue,
  readQueue,
  removeFromQueue,
  type QueuedMutation,
} from "@/lib/offline/queue";

export type SendResult = "sent" | "queued" | "failed";

/** Shown when an action needs a server id that the offline log does not have yet. */
export const NOT_SYNCED_YET =
  "הפריט עוד לא סונכרן. אפשר לסמן אותו כשהחיבור יחזור.";

type OfflineQueue = {
  /** Mutations still waiting for a network, replayed over server data on render. */
  pending: QueuedMutation[];
  pendingMutations: BoardMutation[];
  /** Logs the mutation, sends it, and keeps it logged only if the network failed. */
  run: (entry: QueuedMutation) => Promise<SendResult>;
  /** Swaps a logged mutation for others, e.g. a bulk add that must retry item by item. */
  replace: (clientId: string, entries: QueuedMutation[]) => Promise<void>;
  /** Drops the queued add behind an item that never reached the server. */
  dropQueuedItem: (itemId: string) => Promise<boolean>;
};

const OfflineQueueContext = createContext<OfflineQueue | null>(null);

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<QueuedMutation[]>([]);
  const isFlushing = useRef(false);

  const reload = useCallback(async () => {
    setPending(await readQueue());
  }, []);

  const flush = useCallback(async () => {
    if (isFlushing.current) return;
    isFlushing.current = true;

    try {
      const entries = await readQueue();
      let sent = 0;
      let rejected = 0;

      for (const entry of entries) {
        try {
          await sendMutation(entry);
          await removeFromQueue(entry.clientId);
          sent += 1;
        } catch (error) {
          // Still offline: stop here and keep the rest of the log in order.
          if (isNetworkError(error)) break;
          await removeFromQueue(entry.clientId);
          rejected += 1;
        }
      }

      await reload();

      if (rejected > 0) {
        toast.error(
          rejected === 1
            ? "שינוי אחד לא התקבל בשרת והוסר מהתור."
            : `${rejected} שינויים לא התקבלו בשרת והוסרו מהתור.`,
        );
      }

      if (sent > 0) {
        toast.success(sent === 1 ? "השינוי סונכרן" : `${sent} שינויים סונכרנו`);
        router.refresh();
      }
    } finally {
      isFlushing.current = false;
    }
  }, [reload, router]);

  useEffect(() => {
    // Leftovers from a previous session go out as soon as we have a network again.
    void flush();

    const retry = () => void flush();
    window.addEventListener("online", retry);

    return () => window.removeEventListener("online", retry);
  }, [flush]);

  const run = useCallback(
    async (entry: QueuedMutation): Promise<SendResult> => {
      // Logged before sending, so closing the tab mid-request cannot lose it.
      await appendToQueue([entry]);

      try {
        await sendMutation(entry);
        await removeFromQueue(entry.clientId);
        return "sent";
      } catch (error) {
        if (isNetworkError(error)) {
          await reload();
          return "queued";
        }

        await removeFromQueue(entry.clientId);
        return "failed";
      }
    },
    [reload],
  );

  const replace = useCallback(
    async (clientId: string, entries: QueuedMutation[]) => {
      await removeFromQueue(clientId);
      await appendToQueue(entries);
      await reload();
    },
    [reload],
  );

  const dropQueuedItem = useCallback(
    async (itemId: string) => {
      const match = (await readQueue()).find((entry) =>
        entry.optimistic.some(
          (mutation) => mutation.type === "add" && mutation.item.id === itemId,
        ),
      );

      if (!match) return false;

      await removeFromQueue(match.clientId);
      await reload();
      return true;
    },
    [reload],
  );

  const value = useMemo<OfflineQueue>(
    () => ({
      pending,
      pendingMutations: pending.flatMap((entry) => entry.optimistic),
      run,
      replace,
      dropQueuedItem,
    }),
    [pending, run, replace, dropQueuedItem],
  );

  return (
    <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue(): OfflineQueue {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error("useOfflineQueue דורש OfflineQueueProvider");
  return value;
}
