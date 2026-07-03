/** Format a Date as YYYY-MM-DD in the user's local timezone. */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Shift a local ISO date string by N calendar days. */
export function shiftLocalIso(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return localIsoDate(date);
}

/** Parse a local ISO date string to a Date at local noon (stable for display formatters). */
export function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
