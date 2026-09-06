import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  formatQuantityWithUnit,
  initials,
  joinHebrewNames,
  timeAgo,
} from "@/lib/format";

describe("formatQuantity", () => {
  it("drops the decimals Postgres numeric brings back", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(2.5)).toBe("2.5");
    expect(formatQuantity(2.5049)).toBe("2.5");
    expect(formatQuantity(null)).toBeNull();
  });
});

describe("formatQuantityWithUnit", () => {
  it("appends the unit only when there is one", () => {
    expect(formatQuantityWithUnit(2, "ק״ג")).toBe("2 ק״ג");
    expect(formatQuantityWithUnit(2, null)).toBe("2");
    expect(formatQuantityWithUnit(null, "ק״ג")).toBeNull();
  });
});

describe("initials", () => {
  it("takes at most two letters", () => {
    expect(initials("דני")).toBe("ד");
    expect(initials("שרה כהן")).toBe("שכ");
    expect(initials("  אבא   של   נועם ")).toBe("אש");
  });
});

describe("joinHebrewNames", () => {
  it("uses the Hebrew ו for the last name", () => {
    expect(joinHebrewNames([])).toBe("");
    expect(joinHebrewNames(["אמא"])).toBe("אמא");
    expect(joinHebrewNames(["אמא", "אבא"])).toBe("אמא ואבא");
    expect(joinHebrewNames(["אמא", "אבא", "דני"])).toBe("אמא, אבא ודני");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-01-10T12:00:00.000Z");
  const ago = (ms: number) => timeAgo(new Date(now - ms).toISOString(), now);

  it("covers every bucket", () => {
    expect(ago(30_000)).toBe("עכשיו");
    expect(ago(10 * 60_000)).toBe("לפני 10 דק׳");
    expect(ago(3 * 3_600_000)).toBe("לפני 3 ש׳");
    expect(ago(26 * 3_600_000)).toBe("אתמול");
    expect(ago(3 * 86_400_000)).toBe("לפני 3 ימים");
    expect(ago(14 * 86_400_000)).toBe("לפני 2 שבועות");
    expect(ago(70 * 86_400_000)).toBe("לפני 2 חודשים");
  });
});
