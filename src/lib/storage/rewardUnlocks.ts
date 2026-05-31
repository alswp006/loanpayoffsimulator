import type { RewardUnlocksV1, Result, VoidResult } from "@/lib/types";
import { setItem } from "@/lib/storage";
import { err, isQuotaExceededError, ok } from "@/lib/storage/errors";
import { getSimulationRunById } from "@/lib/storage/runs";

/** localStorage key for reward-ad unlocked run ids. */
export const REWARD_UNLOCKS_KEY = "lps_reward_unlocks_v1";

/** Keep at most N unlocked ids (FIFO eviction). */
export const MAX_UNLOCKS = 50;

type WriteError = "QUOTA_EXCEEDED" | "UNKNOWN_ERROR";

function emptyRewardUnlocks(): RewardUnlocksV1 {
  return { version: 1, unlockedRunIds: [] };
}

function isRewardUnlocksV1(value: unknown): value is RewardUnlocksV1 {
  if (value == null || typeof value !== "object") return false;
  const v = value as { version?: unknown; unlockedRunIds?: unknown };
  return v.version === 1 && Array.isArray(v.unlockedRunIds);
}

function readRewardUnlocks(): Result<RewardUnlocksV1, "PARSE_ERROR"> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(REWARD_UNLOCKS_KEY);
  } catch {
    return err("PARSE_ERROR");
  }
  if (raw == null) return ok(emptyRewardUnlocks());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err("PARSE_ERROR");
  }
  if (!isRewardUnlocksV1(parsed)) return err("PARSE_ERROR");
  return ok(parsed);
}

function writeRewardUnlocks(storage: RewardUnlocksV1): VoidResult<WriteError> {
  try {
    setItem(REWARD_UNLOCKS_KEY, storage);
    return { ok: true, value: null };
  } catch (e) {
    return err(isQuotaExceededError(e) ? "QUOTA_EXCEEDED" : "UNKNOWN_ERROR");
  }
}

/** GET /storage/reward-unlocks */
export function getRewardUnlocks(): Result<RewardUnlocksV1, "PARSE_ERROR"> {
  return readRewardUnlocks();
}

/**
 * POST /storage/reward-unlocks/:runId — idempotent (no-op if already unlocked),
 * FIFO-capped at MAX_UNLOCKS. When `ensureRunExists` (default true), the run must
 * exist in lps_runs_v1 or NOT_FOUND is returned.
 */
export function unlockRunId(
  runId: string,
  options?: { ensureRunExists?: boolean },
): VoidResult<"PARSE_ERROR" | "NOT_FOUND" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const ensureRunExists = options?.ensureRunExists ?? true;

  const r = readRewardUnlocks();
  if (!r.ok) return r;

  if (ensureRunExists) {
    const run = getSimulationRunById(runId);
    if (!run.ok) return run.error === "PARSE_ERROR" ? err("PARSE_ERROR") : err("NOT_FOUND");
  }

  if (r.value.unlockedRunIds.includes(runId)) {
    return { ok: true, value: null };
  }

  const unlockedRunIds = [...r.value.unlockedRunIds, runId];
  while (unlockedRunIds.length > MAX_UNLOCKS) unlockedRunIds.shift();
  return writeRewardUnlocks({ version: 1, unlockedRunIds });
}
