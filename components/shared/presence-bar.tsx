"use client";

import { useRealtime } from "@/lib/realtime/provider";
import { joinHebrewNames } from "@/lib/format";

export function PresenceBar() {
  const { shoppers } = useRealtime();

  if (shoppers.length === 0) return null;

  return (
    <p
      role="status"
      className="mx-4 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm"
    >
      <span aria-hidden>🟢</span>
      {joinHebrewNames(shoppers.map((peer) => peer.name))} בסופר עכשיו
    </p>
  );
}
