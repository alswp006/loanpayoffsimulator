import type { VoidResult } from "@/lib/types";

/** Result constructors shared by every storage module. */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E extends string>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

export function voidOk(): VoidResult<never> {
  return { ok: true, value: null };
}

/**
 * Detects a localStorage quota error across browsers without relying on
 * `instanceof DOMException` (which is unreliable across realms/polyfills).
 */
export function isQuotaExceededError(e: unknown): boolean {
  if (e == null || typeof e !== "object") return false;
  const name = (e as { name?: unknown }).name;
  const code = (e as { code?: unknown }).code;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}
