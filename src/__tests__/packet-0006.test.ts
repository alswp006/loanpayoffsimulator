import { describe, it, expect } from "vitest";
import type { Loan } from "@/lib/types";
import { runStrategySimulation, simulateStrategySummary } from "@/lib/simulation/simulateStrategySummary";

function loan(p: Partial<Loan> & Pick<Loan, "id" | "principalRemaining" | "annualInterestRate" | "monthlyPayment">): Loan {
  return {
    name: p.id,
    remainingMonths: 60,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("packet-0006: single-strategy summary simulation", () => {
  it("AC-1: snowball targets the smallest balance", () => {
    const loans = [
      loan({ id: "A", principalRemaining: 1_000_000, annualInterestRate: 5, monthlyPayment: 50_000 }),
      loan({ id: "B", principalRemaining: 5_000_000, annualInterestRate: 20, monthlyPayment: 50_000 }),
    ];
    const { rows } = runStrategySimulation(loans, "snowball", 100_000);
    expect(rows[0].focusedLoanId).toBe("A"); // smallest balance
  });

  it("AC-2: avalanche targets the highest rate", () => {
    const loans = [
      loan({ id: "A", principalRemaining: 1_000_000, annualInterestRate: 5, monthlyPayment: 50_000 }),
      loan({ id: "B", principalRemaining: 5_000_000, annualInterestRate: 20, monthlyPayment: 50_000 }),
    ];
    const { rows } = runStrategySimulation(loans, "avalanche", 100_000);
    expect(rows[0].focusedLoanId).toBe("B"); // highest rate
  });

  it("AC-3: 3 consecutive non-decreasing-principal months → STALL_3_MONTHS", () => {
    // interest 200k/mo > payment 100k → balance grows every month
    const loans = [loan({ id: "C", principalRemaining: 10_000_000, annualInterestRate: 24, monthlyPayment: 100_000 })];
    const s = simulateStrategySummary(loans, "snowball", 0);
    expect(s.status).toBe("error");
    expect(s.errorCode).toBe("STALL_3_MONTHS");
  });

  it("AC-ENG-4: 720 months reached with balance > 0 → MAX_MONTHS_REACHED", () => {
    // rate 0, pays 1원/mo against 2e9 → never stalls, never finishes in 720
    const loans = [loan({ id: "huge", principalRemaining: 2_000_000_000, annualInterestRate: 0, monthlyPayment: 1 })];
    const { summary, rows } = runStrategySimulation(loans, "snowball", 0);
    expect(summary.status).toBe("error");
    expect(summary.errorCode).toBe("MAX_MONTHS_REACHED");
    expect(rows).toHaveLength(720);
  });

  it("AC-4 / AC-ENG-2: paid-off loan's minimum is redistributed next month", () => {
    const loans = [
      loan({ id: "A", principalRemaining: 100_000, annualInterestRate: 0, monthlyPayment: 100_000 }), // pays off month 1
      loan({ id: "B", principalRemaining: 10_000_000, annualInterestRate: 0, monthlyPayment: 100_000 }),
    ];
    const { rows } = runStrategySimulation(loans, "snowball", 0);
    const bMonth1 = rows[0].perLoan.find((p) => p.loanId === "B")!.paymentTotal;
    const bMonth2 = rows[1].perLoan.find((p) => p.loanId === "B")!.paymentTotal;
    expect(bMonth1).toBe(100_000); // only its own minimum
    expect(bMonth2).toBe(200_000); // + A's freed minimum
    expect(rows[1].totalPayment).toBeGreaterThanOrEqual(rows[0].totalPayment); // 동일 또는 증가
  });

  it("happy path: status ok, all principal repaid, integer totals", () => {
    const loans = [
      loan({ id: "A", principalRemaining: 1_000_000, annualInterestRate: 4, monthlyPayment: 100_000 }),
      loan({ id: "B", principalRemaining: 2_000_000, annualInterestRate: 6, monthlyPayment: 100_000 }),
    ];
    const s = simulateStrategySummary(loans, "avalanche", 100_000);
    expect(s.status).toBe("ok");
    expect(s.monthsToPayoff).toBeGreaterThan(0);
    expect(s.totalPrincipalPaid).toBe(3_000_000); // sum of initial balances
    expect(Number.isInteger(s.totalInterestPaid)).toBe(true);
    expect(s.totalPaid).toBe(s.totalInterestPaid + s.totalPrincipalPaid);
    expect(s.payoffDateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
