/**
 * Browser-safe unique id. Uses crypto.randomUUID when available (Toss WebView,
 * modern browsers, jsdom, Node 18+) and falls back to a timestamp+random id.
 */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Run identifier (alias of createId, named for call-site clarity). */
export function createRunId(): string {
  return createId();
}
