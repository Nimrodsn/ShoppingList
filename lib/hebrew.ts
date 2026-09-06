/**
 * Hebrew text helpers. Pure and framework-free so they can be unit tested.
 *
 * `normalizeHebrew` must stay logically identical to `public.normalize_he(text)` in
 * `supabase/migrations/0001_init.sql`. Changing one means changing the other and
 * updating the equivalence test in `tests/hebrew-sql-equivalence.test.ts`.
 */

/** Niqqud, cantillation marks and other Hebrew combining points: U+0591–U+05C7. */
const HEBREW_POINTS = /[\u0591-\u05C7]/g;

/** Final letters folded to their base form, matching the SQL `translate` call. */
const FINAL_LETTERS: ReadonlyMap<string, string> = new Map([
  ["ם", "מ"],
  ["ן", "נ"],
  ["ץ", "צ"],
  ["ף", "פ"],
  ["ך", "כ"],
]);

/** Gershayim, geresh and ASCII quotes are dropped entirely, matching the SQL. */
const QUOTES = /[\u05F4\u05F3"']/g;

/** Postgres `\s` in a POSIX regex. Deliberately not the wider JS `\s`. */
const ASCII_WHITESPACE = /[ \t\n\r\f\v]+/g;

export function normalizeHebrew(input: string): string {
  let text = input.replace(HEBREW_POINTS, "").toLowerCase();

  for (const [final, base] of FINAL_LETTERS) {
    text = text.split(final).join(base);
  }

  return text.replace(QUOTES, "").replace(ASCII_WHITESPACE, " ").trim();
}

export type ParsedQuantity = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

/**
 * Canonical unit per alias. The value is what we store and display.
 */
const UNIT_ALIASES: ReadonlyMap<string, string> = new Map([
  ["קג", "ק״ג"],
  ["קילו", "ק״ג"],
  ["קילוגרם", "ק״ג"],
  ["kg", "ק״ג"],
  ["גרם", "גרם"],
  ["גר", "גרם"],
  ["g", "גרם"],
  ["ליטר", "ליטר"],
  ["ל", "ליטר"],
  ["l", "ליטר"],
  ["מל", "מ״ל"],
  ["ml", "מ״ל"],
  ["יח", "יח׳"],
  ["יחידה", "יח׳"],
  ["יחידות", "יח׳"],
  ["חבילה", "חבילה"],
  ["חבילות", "חבילה"],
  ["תבנית", "תבנית"],
  ["בקבוק", "בקבוק"],
  ["בקבוקים", "בקבוק"],
  ["קופסה", "קופסה"],
  ["שקית", "שקית"],
  ["מארז", "מארז"],
  ["צנצנת", "צנצנת"],
]);

const LEADING_QUANTITY = /^(\d+(?:[.,]\d+)?)\s*(?:x|×|\*)?\s*/;
const TRAILING_QUANTITY = /\s+(\d+(?:[.,]\d+)?)$/;

function canonicalUnit(token: string): string | null {
  return UNIT_ALIASES.get(normalizeHebrew(token)) ?? null;
}

/**
 * Pulls a quantity and unit out of free text: "2 חלב", "2 ק״ג עגבניות", "חלב 3".
 * Returns the remaining text as `name`. A name-only input yields nulls.
 */
export function parseQuantity(input: string): ParsedQuantity {
  let rest = input.replace(ASCII_WHITESPACE, " ").trim();
  let quantity: number | null = null;
  let unit: string | null = null;

  const leading = LEADING_QUANTITY.exec(rest);
  if (leading) {
    quantity = Number.parseFloat(leading[1].replace(",", "."));
    rest = rest.slice(leading[0].length);

    const [maybeUnit, ...tail] = rest.split(" ");
    if (maybeUnit && tail.length > 0) {
      const resolved = canonicalUnit(maybeUnit);
      if (resolved) {
        unit = resolved;
        rest = tail.join(" ");
      }
    }
  } else {
    const trailing = TRAILING_QUANTITY.exec(rest);
    if (trailing) {
      quantity = Number.parseFloat(trailing[1].replace(",", "."));
      rest = rest.slice(0, trailing.index);
    }
  }

  return { name: rest.trim(), quantity, unit };
}

/**
 * Splits pasted text into individual item strings.
 * Handles newlines, commas, semicolons and the Hebrew "ו" list separator is left alone
 * on purpose, because "עוגה ושוקולד" is usually one product name.
 */
export function splitBulkInput(raw: string): string[] {
  return raw
    .split(/[\n\r,;•]+/)
    .map((part) => part.replace(/^\s*[-*+\d]+[.)]?\s*/, "").trim())
    .filter((part) => part.length > 0);
}
