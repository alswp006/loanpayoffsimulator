import type { RunsStorageV1, SimulationRun, Result, VoidResult } from "@/lib/types";
import { setItem } from "@/lib/storage";
import { err, isQuotaExceededError, ok } from "@/lib/storage/errors";

/** localStorage key for simulation runs. */
export const RUNS_KEY = "lps_runs_v1";

/** Keep only the most recent N runs (FIFO eviction at save time). */
export const MAX_RUNS = 20;

type WriteError = "QUOTA_EXCEEDED" | "UNKNOWN_ERROR";

function emptyRunsStorage(): RunsStorageV1 {
  return { version: 1, items: [] };
}

function isRunsStorageV1(value: unknown): value is RunsStorageV1 {
  if (value == null || typeof value !== "object") return false;
  const v = value as { version?: unknown; items?: unknown };
  return v.version === 1 && Array.isArray(v.items);
}

function readRunsStorage(): Result<RunsStorageV1, "PARSE_ERROR"> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(RUNS_KEY);
  } catch {
    return err("PARSE_ERROR");
  }
  if (raw == null) return ok(emptyRunsStorage());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err("PARSE_ERROR");
  }
  if (!isRunsStorageV1(parsed)) return err("PARSE_ERROR");
  return ok(parsed);
}

function writeRunsStorage(storage: RunsStorageV1): VoidResult<WriteError> {
  try {
    setItem(RUNS_KEY, storage);
    return { ok: true, value: null };
  } catch (e) {
    return err(isQuotaExceededError(e) ? "QUOTA_EXCEEDED" : "UNKNOWN_ERROR");
  }
}

/** GET /storage/runs */
export function getSimulationRuns(): Result<SimulationRun[], "PARSE_ERROR"> {
  const r = readRunsStorage();
  return r.ok ? ok(r.value.items) : r;
}

/** GET /storage/runs/:runId */
export function getSimulationRunById(
  runId: string,
): Result<SimulationRun, "PARSE_ERROR" | "NOT_FOUND"> {
  const r = readRunsStorage();
  if (!r.ok) return r;
  const found = r.value.items.find((run) => run.runId === runId);
  return found ? ok(found) : err("NOT_FOUND");
}

/**
 * POST /storage/runs — newest unshifted to front; FIFO eviction (oldest at the
 * back is popped) keeps items.length <= MAX_RUNS, so evicted runs become Expired.
 */
export function saveSimulationRun(
  run: SimulationRun,
): Result<SimulationRun, "PARSE_ERROR" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const r = readRunsStorage();
  if (!r.ok) return r;
  const items = [run, ...r.value.items];
  while (items.length > MAX_RUNS) items.pop();
  const w = writeRunsStorage({ version: 1, items });
  return w.ok ? ok(run) : err(w.error);
}

/** DELETE /storage/runs/:runId */
export function deleteSimulationRun(
  runId: string,
): VoidResult<"PARSE_ERROR" | "NOT_FOUND" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const r = readRunsStorage();
  if (!r.ok) return r;
  if (!r.value.items.some((run) => run.runId === runId)) return err("NOT_FOUND");
  const items = r.value.items.filter((run) => run.runId !== runId);
  return writeRunsStorage({ version: 1, items });
}

/** POST /storage/runs/reset */
export function resetSimulationRuns(): VoidResult<"QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  return writeRunsStorage(emptyRunsStorage());
}
