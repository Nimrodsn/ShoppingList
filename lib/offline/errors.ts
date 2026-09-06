const NETWORK_MESSAGE =
  /failed to fetch|fetch failed|network ?error|load failed|connection (?:lost|closed|refused)|err_internet_disconnected/i;

/**
 * Tells "the request never reached the server" apart from "the server rejected it".
 * A network failure keeps the mutation in the offline log for a later retry, while a
 * rejection drops it — replaying it would fail forever.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  // A failed `fetch()` — which is how a Server Action call dies without a network.
  if (error instanceof TypeError) return true;

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return NETWORK_MESSAGE.test(message);
}
