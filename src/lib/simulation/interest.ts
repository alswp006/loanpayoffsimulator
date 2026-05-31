/**
 * Monthly interest for a fixed-rate loan, rounded to whole won (Math.round).
 *
 *   월 이자 = round(현재잔액 * (연이율/100) / 12)
 *
 * Always returns a non-negative integer (AC-ENG-1: Number.isInteger === true).
 */
export function calcMonthlyInterest(principalRemaining: number, annualInterestRate: number): number {
  if (!Number.isFinite(principalRemaining) || !Number.isFinite(annualInterestRate)) return 0;
  if (principalRemaining <= 0 || annualInterestRate <= 0) return 0;
  return Math.round((principalRemaining * (annualInterestRate / 100)) / 12);
}
