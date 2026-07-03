/** Allow only same-origin relative paths (blocks open redirects). */
export function safeRedirect(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
