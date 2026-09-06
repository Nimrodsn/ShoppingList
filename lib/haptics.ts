/**
 * Progressive enhancement only. `navigator.vibrate` does not exist on iOS Safari,
 * so every call is guarded and a missing API is simply a no-op.
 */
export function tap(pattern: number | number[] = 10): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}
