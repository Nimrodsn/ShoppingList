import {
  addItem,
  bulkAdd,
  deleteItem,
  restoreItem,
  toggleItem,
  updateItem,
} from "@/actions/items";
import type { QueuedMutation } from "@/lib/offline/queue";

/** Replays one logged mutation. Throws so the caller can tell a retry from a rejection. */
export async function sendMutation(entry: QueuedMutation): Promise<void> {
  switch (entry.kind) {
    case "add":
      await addItem(entry.input);
      return;
    case "bulkAdd":
      await bulkAdd(entry.input);
      return;
    case "restore":
      await restoreItem(entry.input);
      return;
    case "toggle":
      await toggleItem(entry.input);
      return;
    case "update":
      await updateItem(entry.input);
      return;
    case "delete":
      await deleteItem(entry.input);
      return;
  }
}
