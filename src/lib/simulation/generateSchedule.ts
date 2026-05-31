import type { Result, SimulationRun, StrategySchedulePayload, StrategyType } from "@/lib/types";
import { runStrategySimulation } from "@/lib/simulation/simulateStrategySummary";

/**
 * Recompute the detailed month-by-month schedule for a run + strategy at runtime
 * (never persisted). Strategies that ended in error produce no rows.
 *
 * Returns STRATEGY_ERROR when the stored summary for `strategy` is 'error'.
 */
export function generateStrategySchedule(
  run: SimulationRun,
  strategy: StrategyType,
): Result<StrategySchedulePayload, "STRATEGY_ERROR"> {
  if (run.summaries[strategy].status === "error") {
    return { ok: false, error: "STRATEGY_ERROR" };
  }

  const { rows } = runStrategySimulation(run.loanSnapshot, strategy, run.input.extraMonthlyPayment, {
    startDateISO: run.createdAt,
  });

  const totalInterestPaid = rows.reduce((sum, r) => sum + r.totalInterest, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.totalPayment, 0);

  const payload: StrategySchedulePayload = {
    runId: run.runId,
    strategy,
    rows,
    totals: {
      totalInterestPaid,
      totalPrincipalPaid: totalPaid - totalInterestPaid,
      totalPaid,
      months: rows.length,
    },
  };
  return { ok: true, value: payload };
}
