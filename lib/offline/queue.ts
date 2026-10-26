import { createStore, del, get, keys, set, type UseStore } from "idb-keyval";
import type { z } from "zod";
import type { BoardMutation } from "@/lib/board";
import type {
  AddItemSchema,
  BulkAddSchema,
  DeleteItemSchema,
  RestoreItemSchema,
  ToggleItemSchema,
  UpdateItemSchema,
} from "@/lib/schemas";

/**
 * One logged mutation: the arguments to replay against the server plus the board
 * mutations that keep it on screen until it lands. `clientId` is both the log key
 * and the server-side idempotency key, so a retry can never double-apply.
 * `householdId` scopes the entry to the family that made it: joining or leaving a
 * household purges the other family's entries instead of replaying them there.
 */
export type QueuedMutation = {
  clientId: string;
  createdAt: string;
  householdId?: string;
  optimistic: BoardMutation[];
} & (
  | { kind: "add"; input: z.input<typeof AddItemSchema> }
  | { kind: "bulkAdd"; input: z.input<typeof BulkAddSchema> }
  | { kind: "restore"; input: z.input<typeof RestoreItemSchema> }
  | { kind: "toggle"; input: z.input<typeof ToggleItemSchema> }
  | { kind: "update"; input: z.input<typeof UpdateItemSchema> }
  | { kind: "delete"; input: z.input<typeof DeleteItemSchema> }
);

/** IndexedDB said no (private mode, storage denied, quota). Surfaced, never swallowed. */
export class QueueStorageError extends Error {
  constructor(cause: unknown) {
    super("queue storage unavailable");
    this.name = "QueueStorageError";
    this.cause = cause;
  }
}

const DB_NAME = "our-basket";
const STORE_NAME = "mutations";
const KEY_PREFIX = "mutation:";
const CHANNEL_NAME = "our-basket-queue";

let store: UseStore | null = null;

/** Opened on first use: `createStore` touches `indexedDB`, which the server lacks. */
function queueStore(): UseStore {
  store ??= createStore(DB_NAME, STORE_NAME);
  return store;
}

// Writes run strictly in order inside this tab. Across tabs there is no shared
// read-modify-write anymore — each entry is its own key — and the broadcast
// channel tells the other tabs to reload after every change.
let tail: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = tail.then(task, task);
  tail = next.catch(() => undefined);
  return next;
}

function notifyChanged(): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    new BroadcastChannel(CHANNEL_NAME).postMessage("changed");
  } catch {
    // A closed or blocked channel is cosmetic only: this tab's own state is fine.
  }
}

/** Fires when any tab (including this one) changes the log. */
export function onQueueChanged(listener: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = () => listener();
  return () => channel.close();
}

export async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const allKeys = await keys(queueStore());
    const entryKeys = allKeys.filter(
      (key): key is string => typeof key === "string" && key.startsWith(KEY_PREFIX),
    );
    const entries = await Promise.all(
      entryKeys.map((key) => get<QueuedMutation>(key, queueStore())),
    );
    return entries
      .filter((entry): entry is QueuedMutation => entry !== undefined)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    throw new QueueStorageError(error);
  }
}

export function appendToQueue(entries: QueuedMutation[]): Promise<void> {
  return serialize(async () => {
    for (const entry of entries) {
      try {
        // `set` is a no-op overwrite when the clientId is already logged, which is
        // exactly the dedupe the old known-set filter did, one entry at a time.
        await set(`${KEY_PREFIX}${entry.clientId}`, entry, queueStore());
      } catch (error) {
        throw new QueueStorageError(error);
      }
    }
    notifyChanged();
  });
}

export function removeFromQueue(clientId: string): Promise<void> {
  return serialize(async () => {
    try {
      await del(`${KEY_PREFIX}${clientId}`, queueStore());
    } catch (error) {
      throw new QueueStorageError(error);
    }
    notifyChanged();
  });
}

/**
 * Drops every entry that belongs to another household — or every tagged entry when
 * there is no current household at all (the device left). Untagged entries written
 * before this scoping existed are kept; they fail or land exactly as they used to.
 */
export async function purgeOtherHouseholds(
  currentHouseholdId: string | null,
): Promise<void> {
  try {
    const entries = await readQueue();
    const stale = entries.filter(
      (entry) => entry.householdId !== undefined && entry.householdId !== currentHouseholdId,
    );
    for (const entry of stale) {
      await removeFromQueue(entry.clientId);
    }
  } catch {
    // A purge miss is safe: the entries simply replay against the server, which
    // rejects anything for a household this device no longer belongs to.
  }
}
