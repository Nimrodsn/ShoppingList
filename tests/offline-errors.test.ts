import { describe, expect, it } from "vitest";
import { isNetworkError } from "@/lib/offline/errors";

describe("isNetworkError", () => {
  it("keeps mutations that never reached the server", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(
      isNetworkError(new Error("NetworkError when attempting to fetch resource.")),
    ).toBe(true);
    expect(isNetworkError(new Error("Load failed"))).toBe(true);
    expect(isNetworkError("fetch failed")).toBe(true);
  });

  it("drops mutations the server rejected", () => {
    expect(isNetworkError(new Error("הרשימה לא נמצאה"))).toBe(false);
    expect(isNetworkError(new Error("לא הצלחנו להוסיף את הפריט"))).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError({ code: "23505" })).toBe(false);
  });
});
