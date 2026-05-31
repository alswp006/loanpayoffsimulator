import type { Loan, LoansStorageV1, Result, VoidResult } from "@/lib/types";
import { setItem } from "@/lib/storage";
import {
  LOANS_KEY,
  MAX_LOANS,
  emptyLoansStorage,
  isLoansStorageV1,
  isValidLoanInput,
  type LoanInput,
} from "@/lib/storage/schema";
import { err, isQuotaExceededError, ok } from "@/lib/storage/errors";

type WriteError = "QUOTA_EXCEEDED" | "UNKNOWN_ERROR";

/** Read + parse + schema-validate. Missing key is treated as empty storage. */
function readLoansStorage(): Result<LoansStorageV1, "PARSE_ERROR"> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LOANS_KEY);
  } catch {
    return err("PARSE_ERROR");
  }
  if (raw == null) return ok(emptyLoansStorage());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err("PARSE_ERROR");
  }
  if (!isLoansStorageV1(parsed)) return err("PARSE_ERROR");
  return ok(parsed);
}

function writeLoansStorage(storage: LoansStorageV1): VoidResult<WriteError> {
  try {
    setItem(LOANS_KEY, storage);
    return { ok: true, value: null };
  } catch (e) {
    return err(isQuotaExceededError(e) ? "QUOTA_EXCEEDED" : "UNKNOWN_ERROR");
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `loan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// === Public API (Equivalent: REST /storage/loans) ==========================

/** GET /storage/loans */
export function getLoans(): Result<Loan[], "PARSE_ERROR"> {
  const r = readLoansStorage();
  return r.ok ? ok(r.value.items) : r;
}

/** GET /storage/loans/:loanId */
export function getLoanById(loanId: string): Result<Loan, "PARSE_ERROR" | "NOT_FOUND"> {
  const r = readLoansStorage();
  if (!r.ok) return r;
  const found = r.value.items.find((l) => l.id === loanId);
  return found ? ok(found) : err("NOT_FOUND");
}

/** POST /storage/loans */
export function createLoan(
  input: LoanInput,
): Result<Loan, "PARSE_ERROR" | "VALIDATION_ERROR" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const r = readLoansStorage();
  if (!r.ok) return r;
  if (!isValidLoanInput(input)) return err("VALIDATION_ERROR");
  if (r.value.items.length >= MAX_LOANS) return err("VALIDATION_ERROR");

  const ts = nowISO();
  const loan: Loan = {
    id: createId(),
    name: input.name,
    principalRemaining: input.principalRemaining,
    annualInterestRate: input.annualInterestRate,
    remainingMonths: input.remainingMonths,
    monthlyPayment: input.monthlyPayment,
    createdAt: ts,
    updatedAt: ts,
  };
  const next: LoansStorageV1 = { version: 1, items: [...r.value.items, loan] };
  const w = writeLoansStorage(next);
  return w.ok ? ok(loan) : err(w.error);
}

/** PUT /storage/loans/:loanId */
export function updateLoan(
  loanId: string,
  patch: Partial<Pick<Loan, "name" | "principalRemaining" | "annualInterestRate" | "remainingMonths" | "monthlyPayment">>,
): Result<Loan, "PARSE_ERROR" | "NOT_FOUND" | "VALIDATION_ERROR" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const r = readLoansStorage();
  if (!r.ok) return r;
  const idx = r.value.items.findIndex((l) => l.id === loanId);
  if (idx === -1) return err("NOT_FOUND");

  const current = r.value.items[idx];
  const merged: LoanInput = {
    name: patch.name ?? current.name,
    principalRemaining: patch.principalRemaining ?? current.principalRemaining,
    annualInterestRate: patch.annualInterestRate ?? current.annualInterestRate,
    remainingMonths: patch.remainingMonths ?? current.remainingMonths,
    monthlyPayment: patch.monthlyPayment ?? current.monthlyPayment,
  };
  if (!isValidLoanInput(merged)) return err("VALIDATION_ERROR");

  const updated: Loan = { ...current, ...merged, updatedAt: nowISO() };
  const items = [...r.value.items];
  items[idx] = updated;
  const w = writeLoansStorage({ version: 1, items });
  return w.ok ? ok(updated) : err(w.error);
}

/** DELETE /storage/loans/:loanId */
export function deleteLoan(
  loanId: string,
): VoidResult<"PARSE_ERROR" | "NOT_FOUND" | "QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  const r = readLoansStorage();
  if (!r.ok) return r;
  if (!r.value.items.some((l) => l.id === loanId)) return err("NOT_FOUND");
  const items = r.value.items.filter((l) => l.id !== loanId);
  return writeLoansStorage({ version: 1, items });
}

/** POST /storage/loans/reset */
export function resetLoans(): VoidResult<"QUOTA_EXCEEDED" | "UNKNOWN_ERROR"> {
  return writeLoansStorage(emptyLoansStorage());
}
