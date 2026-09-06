"use client";

import { useEffect } from "react";

/**
 * Progressive enhancement. The Screen Wake Lock API landed in iOS 16.4 and does not
 * exist at all in older Safari, so every call is guarded. iOS also releases the lock
 * when the tab loses focus, which is why it is re-acquired on `visibilitychange`.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      if (released || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // A denied or unsupported request just means the screen may dim.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
