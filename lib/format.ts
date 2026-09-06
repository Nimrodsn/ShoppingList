/** Display helpers. Pure, so they are unit tested alongside the Hebrew logic. */

/** Drops a trailing ".00" that numeric(10,2) always brings back from Postgres. */
export function formatQuantity(quantity: number | null): string | null {
  if (quantity === null) return null;
  return Number.isInteger(quantity)
    ? String(quantity)
    : String(Number.parseFloat(quantity.toFixed(2)));
}

export function formatQuantityWithUnit(
  quantity: number | null,
  unit: string | null,
): string | null {
  const amount = formatQuantity(quantity);
  if (!amount) return null;
  return unit ? `${amount} ${unit}` : amount;
}

/** First letters of a member name, for the small avatar next to an item. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

/** Hebrew list join: "אמא", "אמא ואבא", "אמא, אבא ודני". */
export function joinHebrewNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  const head = names.slice(0, -1).join(", ");
  return `${head} ו${names[names.length - 1]}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Hebrew relative time, short form: "לפני 10 דק׳". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const elapsed = now - new Date(iso).getTime();

  if (elapsed < MINUTE) return "עכשיו";
  if (elapsed < HOUR) return `לפני ${Math.floor(elapsed / MINUTE)} דק׳`;
  if (elapsed < DAY) return `לפני ${Math.floor(elapsed / HOUR)} ש׳`;

  const days = Math.floor(elapsed / DAY);
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  return `לפני ${Math.floor(days / 30)} חודשים`;
}
