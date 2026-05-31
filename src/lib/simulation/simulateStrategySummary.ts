import type {
  Loan,
  PaymentScheduleRow,
  PerLoanScheduleBreakdown,
  SimulationErrorCode,
  StrategySummary,
  StrategyType,
} from "@/lib/types";
import { MAX_SIMULATION_MONTHS, STALL_MONTHS_LIMIT } from "@/lib/simulation/constants";
import { calcMonthlyInterest } from "@/lib/simulation/interest";

interface WorkingLoan {
  id: string;
  balance: number;
  rate: number;
  minPayment: number;
}

export interface StrategySimulationResult {
  summary: StrategySummary;
  /** Per-month schedule rows produced while simulating (reused by the schedule generator). */
  rows: PaymentScheduleRow[];
}

/** Strategy target among loans that still owe money (0원 제외). Ties break by input order. */
function selectTarget(loans: WorkingLoan[], strategy: StrategyType): WorkingLoan | null {
  const active = loans.filter((w) => w.balance > 0);
  if (active.length === 0) return null;
  if (strategy === "snowball") {
    // smallest balance first
    return active.reduce((best, w) => (w.balance < best.balance ? w : best), active[0]);
  }
  // avalanche: highest rate first
  return active.reduce((best, w) => (w.rate > best.rate ? w : best), active[0]);
}

function computePayoffDateISO(startISO: string | undefined, months: number): string {
  const base = startISO ? new Date(startISO) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  const d = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Simulate one strategy month-by-month (fixed rate, 월 단위) and return the
 * summary plus the per-month rows. Monthly order per SPEC:
 *   1) accrue interest, 2) pay each loan's minimum (capped at balance),
 *   3) apply the extra pool (extraMonthlyPayment + freed minimums of already
 *      paid-off loans) to the strategy target, cascading to the next target.
 * Terminates on full payoff (ok), 3 consecutive non-decreasing-principal months
 * (STALL_3_MONTHS), or reaching MAX_SIMULATION_MONTHS with balance > 0
 * (MAX_MONTHS_REACHED). All amounts stay integer won.
 */
export function runStrategySimulation(
  loans: Loan[],
  strategy: StrategyType,
  extraMonthlyPayment: number,
  options?: { startDateISO?: string },
): StrategySimulationResult {
  const working: WorkingLoan[] = loans.map((l) => ({
    id: l.id,
    balance: l.principalRemaining,
    rate: l.annualInterestRate,
    minPayment: l.monthlyPayment,
  }));

  const rows: PaymentScheduleRow[] = [];
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let stallCount = 0;
  let monthIndex = 0;
  let errorCode: SimulationErrorCode | null = null;

  const totalBalance = () => working.reduce((sum, w) => sum + Math.max(0, w.balance), 0);
  const extra = Number.isFinite(extraMonthlyPayment) && extraMonthlyPayment > 0 ? extraMonthlyPayment : 0;

  while (totalBalance() > 0) {
    if (monthIndex >= MAX_SIMULATION_MONTHS) {
      errorCode = "MAX_MONTHS_REACHED";
      break;
    }
    monthIndex++;
    const balanceBeforeMonth = totalBalance();

    // Freed minimums from loans paid off in PRIOR months (다음 달부터 재원 합산).
    const freed = working.filter((w) => w.balance <= 0).reduce((sum, w) => sum + w.minPayment, 0);
    let extraPool = extra + freed;

    const paid = new Map<string, number>();
    const interestOf = new Map<string, number>();

    // 1) interest accrual
    for (const w of working) {
      if (w.balance <= 0) {
        interestOf.set(w.id, 0);
        continue;
      }
      const interest = calcMonthlyInterest(w.balance, w.rate);
      w.balance += interest;
      interestOf.set(w.id, interest);
    }

    // 2) minimum payments (capped at balance)
    for (const w of working) {
      if (w.balance <= 0) continue;
      const pay = Math.min(w.minPayment, w.balance);
      w.balance -= pay;
      paid.set(w.id, (paid.get(w.id) ?? 0) + pay);
    }

    // 3) extra pool to strategy target(s)
    const primaryTarget = selectTarget(working, strategy);
    const focusedLoanId = primaryTarget?.id ?? working.find((w) => w.balance > 0)?.id ?? working[0]?.id ?? "";
    while (extraPool > 0) {
      const target = selectTarget(working, strategy);
      if (!target) break;
      const pay = Math.min(extraPool, target.balance);
      if (pay <= 0) break;
      target.balance -= pay;
      extraPool -= pay;
      paid.set(target.id, (paid.get(target.id) ?? 0) + pay);
    }

    // accounting + row
    let rowTotalPayment = 0;
    let rowTotalInterest = 0;
    let rowTotalRemaining = 0;
    const perLoan: PerLoanScheduleBreakdown[] = working.map((w) => {
      const paidTotal = paid.get(w.id) ?? 0;
      const interest = interestOf.get(w.id) ?? 0;
      const interestPaid = Math.min(paidTotal, interest);
      const principalPaid = paidTotal - interestPaid;
      const remainingBalance = Math.max(0, w.balance);
      rowTotalPayment += paidTotal;
      rowTotalInterest += interestPaid;
      rowTotalRemaining += remainingBalance;
      return { loanId: w.id, paymentTotal: paidTotal, interestPaid, principalPaid, remainingBalance };
    });
    totalInterestPaid += rowTotalInterest;
    totalPrincipalPaid += rowTotalPayment - rowTotalInterest;
    rows.push({
      monthIndex,
      totalPayment: rowTotalPayment,
      totalInterest: rowTotalInterest,
      totalRemainingBalance: rowTotalRemaining,
      focusedLoanId,
      perLoan,
    });

    // stall detection (원금 총합이 줄지 않음)
    if (totalBalance() >= balanceBeforeMonth) {
      stallCount++;
      if (stallCount >= STALL_MONTHS_LIMIT) {
        errorCode = "STALL_3_MONTHS";
        break;
      }
    } else {
      stallCount = 0;
    }
  }

  const totalPaid = totalInterestPaid + totalPrincipalPaid;
  const base = { strategy, totalInterestPaid, totalPrincipalPaid, totalPaid, monthlySavingsVsOtherByInterest: 0 };

  if (errorCode) {
    return {
      summary: { ...base, status: "error", errorCode, monthsToPayoff: 0, totalMonths: 0, payoffDateISO: "" },
      rows,
    };
  }
  return {
    summary: {
      ...base,
      status: "ok",
      monthsToPayoff: monthIndex,
      totalMonths: monthIndex,
      payoffDateISO: computePayoffDateISO(options?.startDateISO, monthIndex),
    },
    rows,
  };
}

/** Public summary-only entry point (AC target). */
export function simulateStrategySummary(
  loans: Loan[],
  strategy: StrategyType,
  extraMonthlyPayment: number,
  options?: { startDateISO?: string },
): StrategySummary {
  return runStrategySimulation(loans, strategy, extraMonthlyPayment, options).summary;
}
