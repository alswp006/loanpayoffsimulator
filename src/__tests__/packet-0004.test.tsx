import { describe, it, expect } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Loan, SimulationRun, StrategySummary, StrategyType } from "@/lib/types";
import { LoansProvider, useLoansStore } from "@/lib/store/loansStore";
import { RunsProvider, useRunsStore } from "@/lib/store/runsStore";
import { RewardUnlocksProvider, useRewardUnlocksStore } from "@/lib/store/rewardUnlocksStore";
import { LOANS_KEY } from "@/lib/storage/schema";
import { RUNS_KEY } from "@/lib/storage/runs";
import { REWARD_UNLOCKS_KEY } from "@/lib/storage/rewardUnlocks";

const validInput: Omit<Loan, "id" | "createdAt" | "updatedAt"> = {
  name: "학자금",
  principalRemaining: 12_000_000,
  annualInterestRate: 4.2,
  remainingMonths: 48,
  monthlyPayment: 270_000,
};

function makeLoan(id: string): Loan {
  return { ...validInput, id, name: `loan-${id}`, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
}

function summary(strategy: StrategyType): StrategySummary {
  return {
    strategy, status: "ok", totalInterestPaid: 0, totalPrincipalPaid: 0, totalPaid: 0,
    monthsToPayoff: 0, totalMonths: 0, payoffDateISO: "", monthlySavingsVsOtherByInterest: 0,
  };
}

function makeRun(runId: string): SimulationRun {
  return {
    runId, createdAt: "2026-01-01T00:00:00.000Z",
    input: { loanIds: [], extraMonthlyPayment: 0 },
    loanSnapshot: [],
    summaries: { snowball: summary("snowball"), avalanche: summary("avalanche") },
    comparison: { interestDiff: 0, monthsDiff: 0, winnerByInterest: "tie" },
  };
}

const loansWrapper = ({ children }: { children: ReactNode }) => <LoansProvider>{children}</LoansProvider>;
const runsWrapper = ({ children }: { children: ReactNode }) => <RunsProvider>{children}</RunsProvider>;
const ruWrapper = ({ children }: { children: ReactNode }) => <RewardUnlocksProvider>{children}</RewardUnlocksProvider>;

describe("packet-0004: store providers (hydrate + actions)", () => {
  it("AC-1: LoansProvider isHydrating starts true, then false after hydrate", () => {
    const sink: boolean[] = [];
    function Probe() {
      sink.push(useLoansStore().isHydrating);
      return null;
    }
    render(
      <LoansProvider>
        <Probe />
      </LoansProvider>,
    );
    expect(sink[0]).toBe(true); // first render, before hydrate effect
    expect(sink[sink.length - 1]).toBe(false); // after hydrate
  });

  it("hydrates loans from storage", () => {
    localStorage.setItem(LOANS_KEY, JSON.stringify({ version: 1, items: [makeLoan("1")] }));
    const { result } = renderHook(() => useLoansStore(), { wrapper: loansWrapper });
    expect(result.current.isHydrating).toBe(false);
    expect(result.current.loans).toHaveLength(1);
  });

  it("AC-2: getLoans PARSE_ERROR sets hydrateErrorCode", () => {
    localStorage.setItem(LOANS_KEY, "NOT_JSON");
    const { result } = renderHook(() => useLoansStore(), { wrapper: loansWrapper });
    expect(result.current.hydrateErrorCode).toBe("PARSE_ERROR");
  });

  it("create/update/remove mutate state through the storage layer", () => {
    const { result } = renderHook(() => useLoansStore(), { wrapper: loansWrapper });

    let res: { ok: boolean } | undefined;
    act(() => {
      res = result.current.create(validInput);
    });
    expect(res?.ok).toBe(true);
    expect(result.current.loans).toHaveLength(1);

    const id = result.current.loans[0].id;
    act(() => {
      result.current.update(id, { monthlyPayment: 320_000 });
    });
    expect(result.current.loans[0].monthlyPayment).toBe(320_000);

    act(() => {
      result.current.remove(id);
    });
    expect(result.current.loans).toHaveLength(0);
  });

  it("AC-3: RunsStore.getRunById returns the storage Result", () => {
    localStorage.setItem(RUNS_KEY, JSON.stringify({ version: 1, items: [makeRun("run-1")] }));
    const { result } = renderHook(() => useRunsStore(), { wrapper: runsWrapper });
    expect(result.current.getRunById("run-1").ok).toBe(true);
    expect(result.current.getRunById("nope")).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("RunsStore.save adds a run to state", () => {
    const { result } = renderHook(() => useRunsStore(), { wrapper: runsWrapper });
    act(() => {
      result.current.save(makeRun("run-1"));
    });
    expect(result.current.runs.some((r) => r.runId === "run-1")).toBe(true);
  });

  it("AC-4: RewardUnlocksStore.unlock syncs unlockedRunIds with storage", () => {
    const { result } = renderHook(() => useRewardUnlocksStore(), { wrapper: ruWrapper });
    act(() => {
      result.current.unlock("r1", { ensureRunExists: false });
    });
    expect(result.current.unlockedRunIds).toEqual(["r1"]);
    expect(result.current.isUnlocked("r1")).toBe(true);

    const stored = JSON.parse(localStorage.getItem(REWARD_UNLOCKS_KEY)!);
    expect(result.current.unlockedRunIds).toEqual(stored.unlockedRunIds);
  });
});
