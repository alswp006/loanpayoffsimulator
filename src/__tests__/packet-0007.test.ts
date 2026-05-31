import { describe, it, expect } from "vitest";
import type { Loan, StrategySummary, StrategyType } from "@/lib/types";
import { buildSimulationRun } from "@/lib/simulation/buildSimulationRun";
import { createId, createRunId } from "@/lib/simulation/id";

function loan(id: string, principalRemaining: number, annualInterestRate: number, monthlyPayment: number): Loan {
  return {
    id,
    name: id,
    principalRemaining,
    annualInterestRate,
    remainingMonths: 60,
    monthlyPayment,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function summaryStub(strategy: StrategyType, status: "ok" | "error"): StrategySummary {
  return status === "ok"
    ? {
        strategy, status: "ok", totalInterestPaid: strategy === "snowball" ? 2_100_000 : 1_900_000,
        totalPrincipalPaid: 20_000_000, totalPaid: strategy === "snowball" ? 22_100_000 : 21_900_000,
        monthsToPayoff: strategy === "snowball" ? 40 : 39, totalMonths: strategy === "snowball" ? 40 : 39,
        payoffDateISO: "2030-01-01", monthlySavingsVsOtherByInterest: 0,
      }
    : {
        strategy, status: "error", errorCode: "MAX_MONTHS_REACHED", totalInterestPaid: 0, totalPrincipalPaid: 0,
        totalPaid: 0, monthsToPayoff: 0, totalMonths: 0, payoffDateISO: "", monthlySavingsVsOtherByInterest: 0,
      };
}

describe("packet-0007: buildSimulationRun (assembly + both-error gate)", () => {
  it("AC-1 (injected): both strategies error → BOTH_STRATEGIES_FAILED, no run", () => {
    const simulate = (_l: Loan[], strategy: StrategyType) => summaryStub(strategy, "error");
    const r = buildSimulationRun([loan("a", 1_000_000, 5, 100_000)], 0, { simulate });
    expect(r).toEqual({ ok: false, error: "BOTH_STRATEGIES_FAILED" });
  });

  it("AC-1 (real engine): a single stalling loan fails both strategies", () => {
    const r = buildSimulationRun([loan("c", 10_000_000, 24, 100_000)], 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("BOTH_STRATEGIES_FAILED");
  });

  it("AC-2: one strategy error + one ok → ok, both summaries included", () => {
    const simulate = (_l: Loan[], strategy: StrategyType) =>
      summaryStub(strategy, strategy === "snowball" ? "error" : "ok");
    const r = buildSimulationRun([loan("a", 1_000_000, 5, 100_000)], 100_000, { simulate });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.summaries.snowball.status).toBe("error");
      expect(r.value.summaries.avalanche.status).toBe("ok");
      // one error → comparison neutralized
      expect(r.value.comparison).toEqual({ interestDiff: 0, monthsDiff: 0, winnerByInterest: "tie" });
      expect(r.value.summaries.snowball.monthlySavingsVsOtherByInterest).toBe(0);
    }
  });

  it("both ok → comparison + winner + monthly savings computed", () => {
    const simulate = (_l: Loan[], strategy: StrategyType) => summaryStub(strategy, "ok");
    const r = buildSimulationRun([loan("a", 1_000_000, 5, 100_000)], 100_000, { simulate });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // snowball interest 2.1M > avalanche 1.9M → avalanche wins, diff +200000
      expect(r.value.comparison.interestDiff).toBe(200_000);
      expect(r.value.comparison.monthsDiff).toBe(1);
      expect(r.value.comparison.winnerByInterest).toBe("avalanche");
      // |200000| / min(40,39,720) = 200000/39 → round
      expect(r.value.summaries.snowball.monthlySavingsVsOtherByInterest).toBe(Math.round(200_000 / 39));
      expect(r.value.summaries.avalanche.monthlySavingsVsOtherByInterest).toBe(Math.round(200_000 / 39));
    }
  });

  it("AC-3: loanIds preserve the stored loans order", () => {
    const loans = [loan("L1", 1_000_000, 4, 100_000), loan("L2", 2_000_000, 6, 100_000), loan("L3", 500_000, 3, 100_000)];
    const r = buildSimulationRun(loans, 100_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.input.loanIds).toEqual(["L1", "L2", "L3"]);
      expect(r.value.input.extraMonthlyPayment).toBe(100_000);
      // loanSnapshot is a deep copy (no shared reference with input)
      expect(r.value.loanSnapshot[0]).not.toBe(loans[0]);
      expect(r.value.loanSnapshot[0]).toEqual(loans[0]);
    }
  });

  it("AC-4: ok run has a non-empty runId and a valid createdAt timestamp", () => {
    const r = buildSimulationRun([loan("a", 1_000_000, 4, 100_000)], 100_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(typeof r.value.runId).toBe("string");
      expect(r.value.runId.length).toBeGreaterThan(0);
      // NOTE: SPEC data model fixes createdAt as an ISO string (AC-4's "ms 숫자"
      // wording conflicts with the SimulationRun type, which S4/storage depend on).
      expect(typeof r.value.createdAt).toBe("string");
      expect(Number.isNaN(Date.parse(r.value.createdAt))).toBe(false);
    }
  });

  it("id utils produce distinct non-empty ids", () => {
    expect(createId().length).toBeGreaterThan(0);
    expect(createRunId()).not.toBe(createRunId());
  });
});
