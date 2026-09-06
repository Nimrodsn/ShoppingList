import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 over the cookie payload, base64url encoded. */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Constant-time comparison so a wrong signature reveals nothing through timing. */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signPayload(payload, secret), "utf8");
  const provided = Buffer.from(signature, "utf8");

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
