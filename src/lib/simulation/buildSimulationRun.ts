import type { Loan, Result, SimulationRun, StrategySummary, StrategyType } from "@/lib/types";
import { MAX_SIMULATION_MONTHS } from "@/lib/simulation/constants";
import { simulateStrategySummary } from "@/lib/simulation/simulateStrategySummary";
import { createRunId } from "@/lib/simulation/id";

type StrategySimulator = (
  loans: Loan[],
  strategy: StrategyType,
  extraMonthlyPayment: number,
  options?: { startDateISO?: string },
) => StrategySummary;

/**
 * Assemble a savable SimulationRun by running both strategies independently.
 *
 * - Both strategies error → `{ ok: false, error: 'BOTH_STRATEGIES_FAILED' }`
 *   (no run is produced, so callers must not save/navigate).
 * - Otherwise a run is returned with both summaries; comparison fields are only
 *   meaningful when BOTH strategies are ok (else 0 / 'tie' per SPEC).
 *
 * `options.simulate` / `options.nowISO` exist for deterministic testing.
 */
export function buildSimulationRun(
  loans: Loan[],
  extraMonthlyPayment: number,
  options?: { simulate?: StrategySimulator; nowISO?: string },
): Result<SimulationRun, "BOTH_STRATEGIES_FAILED"> {
  const simulate = options?.simulate ?? simulateStrategySummary;
  const createdAt = options?.nowISO ?? new Date().toISOString();

  const snowball = simulate(loans, "snowball", extraMonthlyPayment, { startDateISO: createdAt });
  const avalanche = simulate(loans, "avalanche", extraMonthlyPayment, { startDateISO: createdAt });

  if (snowball.status === "error" && avalanche.status === "error") {
    return { ok: false, error: "BOTH_STRATEGIES_FAILED" };
  }

  const bothOk = snowball.status === "ok" && avalanche.status === "ok";
  const interestDiff = bothOk ? snowball.totalInterestPaid - avalanche.totalInterestPaid : 0;
  const monthsDiff = bothOk ? snowball.monthsToPayoff - avalanche.monthsToPayoff : 0;
  const winnerByInterest: StrategyType | "tie" = !bothOk
    ? "tie"
    : interestDiff < 0
      ? "snowball"
      : interestDiff > 0
        ? "avalanche"
        : "tie";

  const denom = bothOk
    ? Math.max(1, Math.min(snowball.monthsToPayoff, avalanche.monthsToPayoff, MAX_SIMULATION_MONTHS))
    : 1;
  const monthlySavings = bothOk ? Math.round(Math.abs(interestDiff) / denom) : 0;

  const summaries: Record<StrategyType, StrategySummary> = {
    snowball: { ...snowball, monthlySavingsVsOtherByInterest: monthlySavings },
    avalanche: { ...avalanche, monthlySavingsVsOtherByInterest: monthlySavings },
  };

  const run: SimulationRun = {
    runId: createRunId(),
    createdAt,
    input: { loanIds: loans.map((l) => l.id), extraMonthlyPayment },
    loanSnapshot: loans.map((l) => ({ ...l })), // deep copy of flat Loan — no shared refs
    summaries,
    comparison: { interestDiff, monthsDiff, winnerByInterest },
  };

  return { ok: true, value: run };
}
