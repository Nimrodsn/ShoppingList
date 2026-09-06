import { describe, expect, it } from "vitest";
import { normalizeHebrew, parseQuantity, splitBulkInput } from "@/lib/hebrew";
import {
  HEBREW_INPUTS,
  NORMALIZED_EXPECTATIONS,
} from "@/tests/fixtures/hebrew-inputs";

describe("normalizeHebrew", () => {
  it.each(NORMALIZED_EXPECTATIONS)("%j -> %j", (input, expected) => {
    expect(normalizeHebrew(input)).toBe(expected);
  });

  it("is idempotent over the whole corpus", () => {
    for (const input of HEBREW_INPUTS) {
      const once = normalizeHebrew(input);
      expect(normalizeHebrew(once)).toBe(once);
    }
  });

  it("leaves no final letters, quotes or repeated spaces behind", () => {
    for (const input of HEBREW_INPUTS) {
      const output = normalizeHebrew(input);
      expect(output).not.toMatch(/[םןץףך]/);
      expect(output).not.toMatch(/["'\u05F3\u05F4]/);
      expect(output).not.toMatch(/\s\s/);
      expect(output).toBe(output.trim());
    }
  });

  it("matches spellings that only differ by final letters or quotes", () => {
    expect(normalizeHebrew("קוטג׳")).toBe(normalizeHebrew("קוטג"));
    expect(normalizeHebrew('ק"ג')).toBe(normalizeHebrew("ק״ג"));
  });

  it("keeps full and defective spelling apart", () => {
    expect(normalizeHebrew("יוגורט")).not.toBe(normalizeHebrew("יוגרט"));
  });
});

describe("parseQuantity", () => {
  it("reads a leading quantity", () => {
    expect(parseQuantity("2 חלב")).toEqual({
      name: "חלב",
      quantity: 2,
      unit: null,
    });
  });

  it("reads a leading quantity with a unit", () => {
    expect(parseQuantity("2 ק״ג עגבניות")).toEqual({
      name: "עגבניות",
      quantity: 2,
      unit: "ק״ג",
    });
  });

  it("canonicalises unit aliases", () => {
    expect(parseQuantity("2 קילו בננות").unit).toBe("ק״ג");
    expect(parseQuantity("1 kg קמח").unit).toBe("ק״ג");
    expect(parseQuantity("500 גרם פסטרמה").unit).toBe("גרם");
    expect(parseQuantity("6 יחידות פיתות").unit).toBe("יח׳");
  });

  it("accepts a decimal comma and an x separator", () => {
    expect(parseQuantity("2,5 ליטר חלב")).toEqual({
      name: "חלב",
      quantity: 2.5,
      unit: "ליטר",
    });
    expect(parseQuantity("3 x מלפפונים")).toEqual({
      name: "מלפפונים",
      quantity: 3,
      unit: null,
    });
  });

  it("reads a trailing quantity", () => {
    expect(parseQuantity("חלב 3")).toEqual({
      name: "חלב",
      quantity: 3,
      unit: null,
    });
  });

  it("returns nulls for a name on its own", () => {
    expect(parseQuantity("לחם אחיד")).toEqual({
      name: "לחם אחיד",
      quantity: null,
      unit: null,
    });
  });

  it("treats a word that is not a unit as part of the name", () => {
    expect(parseQuantity("2 מגבות נייר")).toEqual({
      name: "מגבות נייר",
      quantity: 2,
      unit: null,
    });
  });

  it("finds units whose alias carries a final letter", () => {
    expect(parseQuantity("2 שקיות קמח")).toEqual({
      name: "קמח",
      quantity: 2,
      unit: "שקית",
    });
  });

  it("never swallows the whole input as a unit", () => {
    expect(parseQuantity("2 ק״ג")).toEqual({
      name: "ק״ג",
      quantity: 2,
      unit: null,
    });
  });
});

describe("splitBulkInput", () => {
  it("splits on newlines, commas and semicolons", () => {
    expect(splitBulkInput("חלב\nלחם, ביצים; קוטג׳")).toEqual([
      "חלב",
      "לחם",
      "ביצים",
      "קוטג׳",
    ]);
  });

  it("strips list markers and numbering", () => {
    expect(splitBulkInput("1. חלב\n2) לחם\n- ביצים\n* קמח\n• סוכר")).toEqual([
      "חלב",
      "לחם",
      "ביצים",
      "קמח",
      "סוכר",
    ]);
  });

  it("keeps a name containing ו as one item", () => {
    expect(splitBulkInput("עוגה ושוקולד")).toEqual(["עוגה ושוקולד"]);
  });

  it("drops empty fragments", () => {
    expect(splitBulkInput("   ")).toEqual([]);
    expect(splitBulkInput("חלב,,\n\n,לחם")).toEqual(["חלב", "לחם"]);
  });
});
