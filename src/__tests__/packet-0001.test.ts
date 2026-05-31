import { describe, it, expect } from "vitest";
import type {
  Loan,
  LoansStorageV1,
  StrategyType,
  SimulationInput,
  SimulationErrorCode,
  StrategySummary,
  SimulationRunComparison,
  SimulationRun,
  RunsStorageV1,
  PerLoanScheduleBreakdown,
  PaymentScheduleRow,
  MonthlyScheduleRow,
  StrategySchedulePayload,
  RewardUnlocksV1,
  AppSettingsV1,
  StorageErrorCode,
  Result,
  VoidResult,
  RouteState,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Compile-time assertions (enforced by `tsc --noEmit`, the actual AC gate).
// If RouteState's key set drifts from the contract, `Exact` below fails to
// compile, which is the real test for a types-only module.
// ---------------------------------------------------------------------------
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

type RouteKeyContract =
  | "/"
  | "/loan/new"
  | "/loan/edit"
  | "/simulate"
  | "/result"
  | "/schedule"
  | "/settings";

// AC-2: keys are EXACTLY the 7 contract keys (no more, no less).
type _RouteKeysExact = Assert<Equals<keyof RouteState, RouteKeyContract>>;

// AC-2: each route's value type matches SPEC.
type _Home = Assert<Equals<RouteState["/"], { highlightLoanId: string } | undefined>>;
type _LoanNew = Assert<Equals<RouteState["/loan/new"], undefined>>;
type _LoanEdit = Assert<Equals<RouteState["/loan/edit"], { loanId: string }>>;
type _Simulate = Assert<Equals<RouteState["/simulate"], undefined>>;
type _Result = Assert<Equals<RouteState["/result"], { runId: string }>>;
type _Schedule = Assert<Equals<RouteState["/schedule"], { runId: string; strategy: StrategyType }>>;
type _Settings = Assert<Equals<RouteState["/settings"], undefined>>;

describe("packet-0001: domain/storage types + RouteState contract", () => {
  it("AC-1: types.ts has zero runtime exports (pure type module)", async () => {
    const mod = await import("@/lib/types");
    expect(Object.keys(mod)).toHaveLength(0);
  });

  it("AC-2: RouteState exposes exactly the 7 contract keys", () => {
    const keys: Array<keyof RouteState> = [
      "/",
      "/loan/new",
      "/loan/edit",
      "/simulate",
      "/result",
      "/schedule",
      "/settings",
    ];
    expect(new Set(keys).size).toBe(7);

    // Values typecheck against SPEC (compile-time) and carry through at runtime.
    const schedule: RouteState["/schedule"] = { runId: "run-1", strategy: "avalanche" };
    const edit: RouteState["/loan/edit"] = { loanId: "loan-1" };
    const result: RouteState["/result"] = { runId: "run-1" };
    expect(schedule.strategy).toBe("avalanche");
    expect(edit.loanId).toBe("loan-1");
    expect(result.runId).toBe("run-1");
  });

  it("AC-3: major domain/storage types are exported and structurally usable", () => {
    const loan: Loan = {
      id: "loan-1",
      name: "학자금",
      principalRemaining: 12_000_000,
      annualInterestRate: 4.2,
      remainingMonths: 48,
      monthlyPayment: 270_000,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const loansStore: LoansStorageV1 = { version: 1, items: [loan] };
    expect(loansStore.items[0].name).toBe("학자금");

    const input: SimulationInput = { loanIds: ["loan-1"], extraMonthlyPayment: 100_000 };
    const errorCode: SimulationErrorCode = "STALL_3_MONTHS";
    const summary: StrategySummary = {
      strategy: "snowball",
      status: "ok",
      totalInterestPaid: 2_100_000,
      totalPrincipalPaid: 20_000_000,
      totalPaid: 22_100_000,
      monthsToPayoff: 40,
      totalMonths: 40,
      payoffDateISO: "2030-01-01",
      monthlySavingsVsOtherByInterest: 5_000,
    };
    const comparison: SimulationRunComparison = {
      interestDiff: 200_000,
      monthsDiff: 1,
      winnerByInterest: "avalanche",
    };
    const summaries: Record<StrategyType, StrategySummary> = {
      snowball: summary,
      avalanche: { ...summary, strategy: "avalanche" },
    };
    const run: SimulationRun = {
      runId: "run-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      input,
      loanSnapshot: [loan],
      summaries,
      comparison,
    };
    const runsStore: RunsStorageV1 = { version: 1, items: [run] };
    expect(runsStore.items[0].runId).toBe("run-1");
    expect(errorCode).toBe("STALL_3_MONTHS");

    const breakdown: PerLoanScheduleBreakdown = {
      loanId: "loan-1",
      paymentTotal: 300_000,
      interestPaid: 42_000,
      principalPaid: 258_000,
      remainingBalance: 11_742_000,
    };
    const row: PaymentScheduleRow = {
      monthIndex: 1,
      totalPayment: 300_000,
      totalInterest: 42_000,
      totalRemainingBalance: 11_742_000,
      focusedLoanId: "loan-1",
      perLoan: [breakdown],
    };
    const monthly: MonthlyScheduleRow = row;
    const payload: StrategySchedulePayload = {
      runId: "run-1",
      strategy: "snowball",
      rows: [monthly],
      totals: {
        totalInterestPaid: 42_000,
        totalPrincipalPaid: 258_000,
        totalPaid: 300_000,
        months: 1,
      },
    };
    expect(payload.rows[0].monthIndex).toBe(1);

    const unlocks: RewardUnlocksV1 = { version: 1, unlockedRunIds: ["run-1"] };
    const settings: AppSettingsV1 = { version: 1, hasDismissedExternalLinkPolicySheet: false };
    expect(unlocks.unlockedRunIds).toContain("run-1");
    expect(settings.hasDismissedExternalLinkPolicySheet).toBe(false);

    const errCode: StorageErrorCode = "NOT_FOUND";
    const okResult: Result<Loan, StorageErrorCode> = { ok: true, value: loan };
    const failResult: Result<Loan, "NOT_FOUND"> = { ok: false, error: "NOT_FOUND" };
    const voidOk: VoidResult<"QUOTA_EXCEEDED"> = { ok: true, value: null };
    expect(errCode).toBe("NOT_FOUND");
    expect(okResult.ok).toBe(true);
    expect(failResult.ok).toBe(false);
    expect(voidOk.ok).toBe(true);
  });
});
