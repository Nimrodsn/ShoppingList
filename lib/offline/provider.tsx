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
import { HOUSEHOLD_ID_COOKIE } from "@/lib/auth/constants";
import type { BoardMutation } from "@/lib/board";
import { sendMutation } from "@/lib/offline/dispatch";
import { isNetworkError } from "@/lib/offline/errors";
import {
  appendToQueue,
  onQueueChanged,
  purgeOtherHouseholds,
  QueueStorageError,
  readQueue,
  removeFromQueue,
  type QueuedMutation,
} from "@/lib/offline/queue";

export type SendStatus = "sent" | "queued" | "failed";

export type RunResult = {
  status: SendStatus;
  /** The server action's return value, present only on "sent". */
  result?: unknown;
};

function currentHouseholdId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${HOUSEHOLD_ID_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/** Serializes flushes across tabs; falls back to the in-tab guard when unsupported. */
async function withFlushLock(task: () => Promise<void>): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request("our-basket-flush", task);
    return;
  }
  await task;
}

type OfflineQueue = {
  /** Mutations still waiting for a network, replayed over server data on render. */
  pending: QueuedMutation[];
  pendingMutations: BoardMutation[];
  /** False once IndexedDB refuses a read or write; the banner says so, persistently. */
  storageOk: boolean;
  /** Logs the mutation, sends it, and keeps it logged only if the network failed. */
  run: (entry: QueuedMutation) => Promise<RunResult>;
  /** Swaps a logged mutation for others, e.g. a bulk add that must retry item by item. */
  replace: (clientId: string, entries: QueuedMutation[]) => Promise<void>;
  /** Drops the queued add behind an item that never reached the server. */
  dropQueuedItem: (itemId: string) => Promise<boolean>;
};

const OfflineQueueContext = createContext<OfflineQueue | null>(null);

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<QueuedMutation[]>([]);
  const [storageOk, setStorageOk] = useState(true);
  const isFlushing = useRef(false);

  const reload = useCallback(async () => {
    try {
      setPending(await readQueue());
      setStorageOk(true);
    } catch (error) {
      if (error instanceof QueueStorageError) {
        setStorageOk(false);
        return;
      }
      throw error;
    }
  }, []);

  const flush = useCallback(async () => {
    if (isFlushing.current) return;
    isFlushing.current = true;

    try {
      await withFlushLock(async () => {
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
      });
    } catch (error) {
      if (!(error instanceof QueueStorageError)) throw error;
      setStorageOk(false);
    } finally {
      isFlushing.current = false;
    }
  }, [reload, router]);

  useEffect(() => {
    // Leftovers from a previous session go out as soon as we have a network again,
    // but only this household's: a join or a leave purges the other family's entries.
    void purgeOtherHouseholds(currentHouseholdId()).then(() => flush());

    const retry = () => void flush();
    window.addEventListener("online", retry);
    const unsubscribe = onQueueChanged(() => void reload());

    return () => {
      window.removeEventListener("online", retry);
      unsubscribe();
    };
  }, [flush, reload]);

  const run = useCallback(
    async (entry: QueuedMutation): Promise<RunResult> => {
      // Logged before sending, so closing the tab mid-request cannot lose it.
      const tagged: QueuedMutation = {
        ...entry,
        householdId: entry.householdId ?? currentHouseholdId() ?? undefined,
      };

      try {
        await appendToQueue([tagged]);
      } catch (error) {
        if (!(error instanceof QueueStorageError)) throw error;
        // No durable log: the send below is the only chance this mutation gets.
        setStorageOk(false);
        try {
          const result = await sendMutation(tagged);
          return { status: "sent", result };
        } catch {
          return { status: "failed" };
        }
      }

      try {
        const result = await sendMutation(tagged);
        await removeFromQueue(tagged.clientId);
        return { status: "sent", result };
      } catch (error) {
        if (isNetworkError(error)) {
          await reload();
          return { status: "queued" };
        }

        await removeFromQueue(tagged.clientId);
        return { status: "failed" };
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
      storageOk,
      run,
      replace,
      dropQueuedItem,
    }),
    [pending, storageOk, run, replace, dropQueuedItem],
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
