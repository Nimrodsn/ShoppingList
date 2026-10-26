import {
  addItem,
  bulkAdd,
  deleteItem,
  restoreItem,
  toggleItem,
  updateItem,
} from "@/actions/items";
import type { QueuedMutation } from "@/lib/offline/queue";

/**
 * Replays one logged mutation and hands back the server's result, so callers can
 * show real counts instead of guessing from optimistic state. Throws so the caller
 * can tell a retry from a rejection.
 */
export async function sendMutation(entry: QueuedMutation): Promise<unknown> {
  switch (entry.kind) {
    case "add":
      return await addItem(entry.input);
    case "bulkAdd":
      return await bulkAdd(entry.input);
    case "restore":
      return await restoreItem(entry.input);
    case "toggle":
      return await toggleItem(entry.input);
    case "update":
      return await updateItem(entry.input);
    case "delete":
      return await deleteItem(entry.input);
  }
}
