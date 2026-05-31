import { describe, it, expect, vi, afterEach } from "vitest";
import type { SimulationRun, StrategySummary, StrategyType } from "@/lib/types";
import {
  RUNS_KEY,
  getSimulationRuns,
  getSimulationRunById,
  saveSimulationRun,
  deleteSimulationRun,
  resetSimulationRuns,
} from "@/lib/storage/runs";
import {
  REWARD_UNLOCKS_KEY,
  getRewardUnlocks,
  unlockRunId,
} from "@/lib/storage/rewardUnlocks";
import { SETTINGS_KEY, getSettings, updateSettings } from "@/lib/storage/settings";

function summary(strategy: StrategyType): StrategySummary {
  return {
    strategy,
    status: "ok",
    totalInterestPaid: 0,
    totalPrincipalPaid: 0,
    totalPaid: 0,
    monthsToPayoff: 0,
    totalMonths: 0,
    payoffDateISO: "",
    monthlySavingsVsOtherByInterest: 0,
  };
}

function makeRun(runId: string): SimulationRun {
  return {
    runId,
    createdAt: "2026-01-01T00:00:00.000Z",
    input: { loanIds: [], extraMonthlyPayment: 0 },
    loanSnapshot: [],
    summaries: { snowball: summary("snowball"), avalanche: summary("avalanche") },
    comparison: { interestDiff: 0, monthsDiff: 0, winnerByInterest: "tie" },
  };
}

function seedRuns(ids: string[]) {
  localStorage.setItem(
    RUNS_KEY,
    JSON.stringify({ version: 1, items: ids.map(makeRun) }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("packet-0003: Runs / RewardUnlocks / Settings storage", () => {
  it("AC-1: saveSimulationRun unshifts newest and FIFO-evicts to <= 20", () => {
    seedRuns(Array.from({ length: 20 }, (_, i) => `old-${i}`));
    const r = saveSimulationRun(makeRun("newest"));
    expect(r.ok).toBe(true);
    const stored = JSON.parse(localStorage.getItem(RUNS_KEY)!);
    expect(stored.items).toHaveLength(20);
    expect(stored.items[0].runId).toBe("newest"); // unshift → newest at front
    // front = newest, back = oldest; pop evicts the back (oldest = last seeded).
    expect(stored.items.some((x: SimulationRun) => x.runId === "old-19")).toBe(false); // oldest evicted
    expect(stored.items.some((x: SimulationRun) => x.runId === "old-0")).toBe(true); // newer survivor kept
  });

  it("AC-2: getSimulationRuns / getSimulationRunById return PARSE_ERROR on bad data", () => {
    localStorage.setItem(RUNS_KEY, "NOT_JSON");
    expect(getSimulationRuns()).toEqual({ ok: false, error: "PARSE_ERROR" });
    expect(getSimulationRunById("x")).toEqual({ ok: false, error: "PARSE_ERROR" });

    localStorage.setItem(RUNS_KEY, JSON.stringify({ version: 1, items: {} }));
    expect(getSimulationRuns()).toEqual({ ok: false, error: "PARSE_ERROR" });
  });

  it("getSimulationRunById: ok when present, NOT_FOUND when absent", () => {
    seedRuns(["run-1"]);
    expect(getSimulationRunById("run-1").ok).toBe(true);
    expect(getSimulationRunById("nope")).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("deleteSimulationRun + resetSimulationRuns", () => {
    seedRuns(["run-1", "run-2"]);
    expect(deleteSimulationRun("run-1")).toEqual({ ok: true, value: null });
    expect(JSON.parse(localStorage.getItem(RUNS_KEY)!).items).toHaveLength(1);
    expect(deleteSimulationRun("run-1")).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(resetSimulationRuns()).toEqual({ ok: true, value: null });
    expect(JSON.parse(localStorage.getItem(RUNS_KEY)!)).toEqual({ version: 1, items: [] });
  });

  it("AC-3: unlockRunId is idempotent for an existing id", () => {
    expect(unlockRunId("r1", { ensureRunExists: false })).toEqual({ ok: true, value: null });
    expect(unlockRunId("r1", { ensureRunExists: false })).toEqual({ ok: true, value: null });
    const r = getRewardUnlocks();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.unlockedRunIds).toEqual(["r1"]);
  });

  it("AC-4: unlockRunId keeps at most 50 ids (FIFO)", () => {
    for (let i = 0; i < 51; i++) {
      unlockRunId(`u${i}`, { ensureRunExists: false });
    }
    const r = getRewardUnlocks();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.unlockedRunIds).toHaveLength(50);
      expect(r.value.unlockedRunIds).not.toContain("u0"); // oldest evicted
      expect(r.value.unlockedRunIds).toContain("u50"); // newest kept
    }
  });

  it("unlockRunId returns NOT_FOUND when ensureRunExists and run is missing", () => {
    expect(unlockRunId("ghost")).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("unlockRunId succeeds when ensureRunExists and the run exists", () => {
    seedRuns(["run-1"]);
    expect(unlockRunId("run-1")).toEqual({ ok: true, value: null });
    const r = getRewardUnlocks();
    if (r.ok) expect(r.value.unlockedRunIds).toContain("run-1");
  });

  it("settings: defaults when missing, then patch-merges", () => {
    const def = getSettings();
    expect(def.ok).toBe(true);
    if (def.ok) expect(def.value).toEqual({ version: 1, hasDismissedExternalLinkPolicySheet: false });

    const upd = updateSettings({ hasDismissedExternalLinkPolicySheet: true });
    expect(upd.ok).toBe(true);
    if (upd.ok) expect(upd.value.hasDismissedExternalLinkPolicySheet).toBe(true);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({
      version: 1,
      hasDismissedExternalLinkPolicySheet: true,
    });
  });

  it("QUOTA_EXCEEDED surfaces from saveSimulationRun when setItem throws quota", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(saveSimulationRun(makeRun("x"))).toEqual({ ok: false, error: "QUOTA_EXCEEDED" });
  });
});
