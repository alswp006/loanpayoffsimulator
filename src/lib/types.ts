// ---------------------------------------------------------------------------
// Domain / storage / engine / route types for LoanPayoffSimulator.
//
// PURE TYPES ONLY — this module must emit ZERO runtime code (no functions,
// constants, or value exports). It is the single source of truth that every
// page/storage/engine packet imports from. Do NOT redefine these elsewhere.
// ---------------------------------------------------------------------------

// === Domain: Loan ==========================================================

/** 대출 1건. */
export interface Loan {
  id: string; // uuid
  name: string; // 1~30자
  principalRemaining: number; // 원, 1~2_000_000_000
  annualInterestRate: number; // 0~30 (percent)
  remainingMonths: number; // 1~600
  monthlyPayment: number; // 원, 1~50_000_000
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** localStorage key: `lps_loans_v1`. items.length <= 200. */
export interface LoansStorageV1 {
  version: 1;
  items: Loan[];
}

// === Domain: SimulationRun =================================================

export type StrategyType = "snowball" | "avalanche";

export interface SimulationInput {
  /**
   * MVP 계약: 항상 "실행 시점에 저장된 전체 대출"의 id 목록.
   * 정렬은 실행 시점 loanSnapshot 배열 순서를 따른다.
   */
  loanIds: string[];
  extraMonthlyPayment: number; // 원/월, 0~50_000_000
}

export type SimulationErrorCode = "STALL_3_MONTHS" | "MAX_MONTHS_REACHED";

export interface StrategySummary {
  strategy: StrategyType;

  /** ok: 정상 완납 / error: 오류 중단(errorCode로 원인 식별). */
  status: "ok" | "error";
  errorCode?: SimulationErrorCode;

  /**
   * 누적 합계(원, integer, >= 0). status='error'여도 오류 직전까지 누적값을 저장.
   */
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalPaid: number; // = totalPrincipalPaid + totalInterestPaid

  /**
   * 총 상환 기간(개월, integer, 0~720). status='error'면 0/0/"" 로 저장.
   */
  monthsToPayoff: number;
  totalMonths: number;
  payoffDateISO: string; // ISO (YYYY-MM-DD) or "" when error

  /**
   * 두 전략 중 "총이자가 더 큰 전략" 기준 월평균 이자 절감액(원/월, integer, >= 0).
   * 둘 중 하나라도 error면 0.
   */
  monthlySavingsVsOtherByInterest: number;
}

export interface SimulationRunComparison {
  /** snowball.totalInterestPaid - avalanche.totalInterestPaid (원). error 포함 시 0. */
  interestDiff: number;
  /** snowball.monthsToPayoff - avalanche.monthsToPayoff (개월). error 포함 시 0. */
  monthsDiff: number;
  /** error 포함 시 'tie'. */
  winnerByInterest: StrategyType | "tie";
}

export interface SimulationRun {
  runId: string; // uuid
  createdAt: string; // ISO
  input: SimulationInput;

  /** 실행 시점 deep copy 스냅샷 — 이후 Loan 수정/삭제와 무관(참조 공유 금지). */
  loanSnapshot: Loan[];

  summaries: Record<StrategyType, StrategySummary>;

  /** S4 절감액/우승 전략 표시용 저장형 비교 필드. */
  comparison: SimulationRunComparison;
}

/** localStorage key: `lps_runs_v1`. items maxItems: 20 (FIFO eviction). */
export interface RunsStorageV1 {
  version: 1;
  items: SimulationRun[];
}

// === Domain: Schedule (runtime-only, never persisted) ======================

export interface PerLoanScheduleBreakdown {
  loanId: string;
  paymentTotal: number; // = interestPaid + principalPaid (원, integer, >= 0)
  interestPaid: number; // 원, integer, >= 0
  principalPaid: number; // 원, integer, >= 0
  remainingBalance: number; // 월 말 잔액(원, integer, >= 0)
}

export interface PaymentScheduleRow {
  monthIndex: number; // 1부터, 1~720
  totalPayment: number; // 해당 월 총 납입(원, integer, >= 0)
  totalInterest: number; // 해당 월 총 이자(원, integer, >= 0)
  totalRemainingBalance: number; // 월 말 전체 잔액 합(원, integer, >= 0)

  focusedLoanId: string; // 해당 월 타겟 대출 id (loanSnapshot 내 id)

  /** loanSnapshot에 포함된 loanId만, 길이는 loanSnapshot 길이와 동일. */
  perLoan: PerLoanScheduleBreakdown[];
}

/** 본 SPEC에서 "월별 스케줄 행"은 MonthlyScheduleRow == PaymentScheduleRow. */
export type MonthlyScheduleRow = PaymentScheduleRow;

export interface StrategySchedulePayload {
  runId: string; // uuid
  strategy: StrategyType;
  rows: MonthlyScheduleRow[]; // length: 0~720

  /** S5 합계 노출/검증용 (rows 합계와 동일해야 함). */
  totals: {
    totalInterestPaid: number; // 원, integer, >= 0
    totalPrincipalPaid: number; // 원, integer, >= 0
    totalPaid: number; // 원, integer, >= 0
    months: number; // 개월, integer, 0~720 (= rows.length)
  };
}

// === Domain: RewardUnlocks / AppSettings ===================================

/** localStorage key: `lps_reward_unlocks_v1`. 최대 50개 유지(FIFO). */
export interface RewardUnlocksV1 {
  version: 1;
  unlockedRunIds: string[];
}

/** localStorage key: `lps_settings_v1`. */
export interface AppSettingsV1 {
  version: 1;
  hasDismissedExternalLinkPolicySheet: boolean; // 기본 false
}

// === Storage service result/error types ====================================

export type StorageErrorCode =
  | "QUOTA_EXCEEDED" // localStorage 용량 초과(QuotaExceededError)
  | "PARSE_ERROR" // JSON.parse 실패 또는 스키마 불일치로 복구 불가
  | "NOT_FOUND" // id로 조회했으나 없음
  | "VALIDATION_ERROR" // 입력값 유효성 실패
  | "UNKNOWN_ERROR"; // 그 외 예외

export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type VoidResult<E extends string> = Result<null, E>;

// === Navigation: RouteState (location.state) contract ======================

/**
 * 라우트별 `location.state` 계약. 모든 페이지에서 state 캐스팅/가드의 기준.
 * 키는 정확히 아래 7개로 고정한다.
 */
export interface RouteState {
  "/": { highlightLoanId: string } | undefined;
  "/loan/new": undefined;
  "/loan/edit": { loanId: string };
  "/simulate": undefined;
  "/result": { runId: string };
  "/schedule": { runId: string; strategy: StrategyType };
  "/settings": undefined;
}
