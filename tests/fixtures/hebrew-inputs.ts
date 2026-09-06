/**
 * One corpus, two consumers: the unit tests for `normalizeHebrew` and the
 * equivalence test that runs the same strings through `normalize_he` in SQL.
 * Anything that ever normalized wrong in real use belongs here.
 */
export const HEBREW_INPUTS: readonly string[] = [
  // niqqud and cantillation
  "בָּנָנָה",
  "פִּיצָה",
  "לֶחֶם אָחִיד",
  // every final letter
  "לחם",
  "שמן זית",
  "מלפפון",
  "תפוח עץ",
  "כף",
  "אגוזי מלך",
  // quotes: gershayim, geresh, ASCII
  "ק״ג",
  "קוטג׳",
  'חלב "טרה"',
  "שמן קנולה 'עלית'",
  // whitespace
  "  שוקולד   מריר  ",
  "שוקולד\tמריר",
  "לחם\nפרוס",
  // latin and digits
  "Coca Cola",
  "COTTAGE 5%",
  "חלב 3%",
  // full vs defective spelling, kept distinct on purpose
  "יוגורט",
  "יוגרט",
  // degenerate input
  "",
  "   ",
  "״",
];

/** Cases where the expected output is worth stating out loud. */
export const NORMALIZED_EXPECTATIONS: readonly [input: string, expected: string][] = [
  ["בָּנָנָה", "בננה"],
  ["לֶחֶם אָחִיד", "לחמ אחיד"],
  ["לחם", "לחמ"],
  ["שמן זית", "שמנ זית"],
  ["מלפפון", "מלפפונ"],
  ["תפוח עץ", "תפוח עצ"],
  ["כף", "כפ"],
  ["אגוזי מלך", "אגוזי מלכ"],
  ["ק״ג", "קג"],
  ["קוטג׳", "קוטג"],
  ['חלב "טרה"', "חלב טרה"],
  ["  שוקולד   מריר  ", "שוקולד מריר"],
  ["שוקולד\tמריר", "שוקולד מריר"],
  ["Coca Cola", "coca cola"],
  ["COTTAGE 5%", "cottage 5%"],
  ["", ""],
  ["   ", ""],
  ["״", ""],
];
