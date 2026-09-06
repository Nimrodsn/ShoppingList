"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineQueue } from "@/lib/offline/provider";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { pending } = useOfflineQueue();

  if (isOnline && pending.length === 0) return null;

  const waiting =
    pending.length === 0
      ? "אפשר להמשיך להוסיף ולסמן"
      : pending.length === 1
        ? "שינוי אחד מחכה לחיבור"
        : `${pending.length} שינויים מחכים לחיבור`;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-accent px-4 py-2 text-sm text-accent-foreground"
    >
      {isOnline ? (
        <>
          <RefreshCw className="size-4 animate-spin" aria-hidden />
          מסנכרן את מה שהוספתם באוף-ליין…
        </>
      ) : (
        <>
          <CloudOff className="size-4" aria-hidden />
          אין חיבור. {waiting}.
        </>
      )}
    </div>
  );
}
