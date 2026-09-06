import { createStore, get, set, type UseStore } from "idb-keyval";
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
 */
export type QueuedMutation = {
  clientId: string;
  optimistic: BoardMutation[];
} & (
  | { kind: "add"; input: z.input<typeof AddItemSchema> }
  | { kind: "bulkAdd"; input: z.input<typeof BulkAddSchema> }
  | { kind: "restore"; input: z.input<typeof RestoreItemSchema> }
  | { kind: "toggle"; input: z.input<typeof ToggleItemSchema> }
  | { kind: "update"; input: z.input<typeof UpdateItemSchema> }
  | { kind: "delete"; input: z.input<typeof DeleteItemSchema> }
);

const DB_NAME = "our-basket";
const STORE_NAME = "mutations";
const QUEUE_KEY = "queue";

let store: UseStore | null = null;

/** Opened on first use: `createStore` touches `indexedDB`, which the server lacks. */
function queueStore(): UseStore {
  store ??= createStore(DB_NAME, STORE_NAME);
  return store;
}

// Every write is a read-modify-write of one array, so writes run strictly in order.
let tail: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = tail.then(task, task);
  tail = next.catch(() => undefined);
  return next;
}

export async function readQueue(): Promise<QueuedMutation[]> {
  try {
    return (await get<QueuedMutation[]>(QUEUE_KEY, queueStore())) ?? [];
  } catch {
    // No IndexedDB (private mode, storage denied): the online path still works.
    return [];
  }
}

async function write(entries: QueuedMutation[]): Promise<void> {
  try {
    await set(QUEUE_KEY, entries, queueStore());
  } catch {
    return;
  }
}

export function appendToQueue(entries: QueuedMutation[]): Promise<void> {
  return serialize(async () => {
    const current = await readQueue();
    const known = new Set(current.map((entry) => entry.clientId));
    const added = entries.filter((entry) => !known.has(entry.clientId));
    if (added.length === 0) return;
    await write([...current, ...added]);
  });
}

export function removeFromQueue(clientId: string): Promise<void> {
  return serialize(async () => {
    const current = await readQueue();
    await write(current.filter((entry) => entry.clientId !== clientId));
  });
}
