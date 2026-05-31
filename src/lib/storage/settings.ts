import type { AppSettingsV1, Result } from "@/lib/types";
import { setItem } from "@/lib/storage";
import { err, isQuotaExceededError, ok } from "@/lib/storage/errors";

/** localStorage key for app settings / review flags. */
export const SETTINGS_KEY = "lps_settings_v1";

function defaultSettings(): AppSettingsV1 {
  return { version: 1, hasDismissedExternalLinkPolicySheet: false };
}

function isAppSettingsV1(value: unknown): value is AppSettingsV1 {
  if (value == null || typeof value !== "object") return false;
  const v = value as { version?: unknown; hasDismissedExternalLinkPolicySheet?: unknown };
  return v.version === 1 && typeof v.hasDismissedExternalLinkPolicySheet === "boolean";
}

function readSettings(): Result<AppSettingsV1, "PARSE_ERROR"> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch {
    return err("PARSE_ERROR");
  }
  if (raw == null) return ok(defaultSettings());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err("PARSE_ERROR");
  }
  if (!isAppSettingsV1(parsed)) return err("PARSE_ERROR");
  return ok(parsed);
}

/** GET /storage/settings — missing key resolves to defaults. */
export function getSettings(): Result<AppSettingsV1, "PARSE_ERROR"> {
  return readSettings();
}

/** PATCH /storage/settings — shallow patch-merge (version pinned to 1). */
export function updateSettings(
  patch: Partial<Omit<AppSettingsV1, "version">>,
): Result<AppSettingsV1, "PARSE_ERROR" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const r = readSettings();
  if (!r.ok) return r;
  const merged: AppSettingsV1 = { ...r.value, ...patch, version: 1 };
  try {
    setItem(SETTINGS_KEY, merged);
    return ok(merged);
  } catch (e) {
    return err(isQuotaExceededError(e) ? "QUOTA_EXCEEDED" : "UNKNOWN_ERROR");
  }
}
