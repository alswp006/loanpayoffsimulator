import { describe, it, expect } from "vitest";
import type { Loan, StrategyType } from "@/lib/types";
import { buildSimulationRun } from "@/lib/simulation/buildSimulationRun";
import { generateStrategySchedule } from "@/lib/simulation/generateSchedule";

function loan(id: string, principalRemaining: number, annualInterestRate: number, monthlyPayment: number): Loan {
  return {
    id, name: id, principalRemaining, annualInterestRate, remainingMonths: 60, monthlyPayment,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const okLoans = [loan("A", 1_000_000, 4, 100_000), loan("B", 2_000_000, 6, 100_000)];

function buildOkRun() {
  const r = buildSimulationRun(okLoans, 100_000, { nowISO: "2026-01-01T00:00:00.000Z" });
  if (!r.ok) throw new Error("expected ok run");
  return r.value;
}

describe("packet-0008: runtime schedule generator", () => {
  it("AC-1: ok strategy → ok payload with rows", () => {
    const run = buildOkRun();
    const res = generateStrategySchedule(run, "snowball");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.value.runId).toBe(run.runId);
      expect(res.value.strategy).toBe("snowball");
    }
  });

  it("AC-2: error strategy → STRATEGY_ERROR, no rows", () => {
    // Force snowball summary to 'error' via injected simulator; avalanche ok.
    const simulate = (_l: Loan[], strategy: StrategyType) =>
      strategy === "snowball"
        ? {
            strategy, status: "error" as const, errorCode: "MAX_MONTHS_REACHED" as const,
            totalInterestPaid: 0, totalPrincipalPaid: 0, totalPaid: 0, monthsToPayoff: 0, totalMonths: 0,
            payoffDateISO: "", monthlySavingsVsOtherByInterest: 0,
          }
        : {
            strategy, status: "ok" as const, totalInterestPaid: 1_000, totalPrincipalPaid: 3_000_000,
            totalPaid: 3_001_000, monthsToPayoff: 20, totalMonths: 20, payoffDateISO: "2027-09-01",
            monthlySavingsVsOtherByInterest: 0,
          };
    const built = buildSimulationRun(okLoans, 100_000, { simulate, nowISO: "2026-01-01T00:00:00.000Z" });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(generateStrategySchedule(built.value, "snowball")).toEqual({ ok: false, error: "STRATEGY_ERROR" });
      expect(generateStrategySchedule(built.value, "avalanche").ok).toBe(true); // re-simulated from real snapshot
    }
  });

  it("AC-3: rows match the PaymentScheduleRow type (integers, monthIndex from 1)", () => {
    const run = buildOkRun();
    const res = generateStrategySchedule(run, "avalanche");
    expect(res.ok).toBe(true);
    if (res.ok) {
      const { rows, totals } = res.value;
      expect(rows[0].monthIndex).toBe(1);
      for (const r of rows) {
        expect(Number.isInteger(r.totalInterest)).toBe(true);
        expect(Number.isInteger(r.totalPayment)).toBe(true);
        expect(Number.isInteger(r.totalRemainingBalance)).toBe(true);
        expect(r.totalRemainingBalance).toBeGreaterThanOrEqual(0);
        expect(r.perLoan).toHaveLength(run.loanSnapshot.length);
      }
      // totals equal the row aggregation
      expect(totals.totalInterestPaid).toBe(rows.reduce((s, r) => s + r.totalInterest, 0));
      expect(totals.months).toBe(rows.length);
      expect(totals.totalPaid).toBe(totals.totalInterestPaid + totals.totalPrincipalPaid);
    }
  });
});
