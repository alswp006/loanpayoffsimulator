import { describe, it, expect, vi, afterEach } from "vitest";
import type { Loan } from "@/lib/types";
import { LOANS_KEY } from "@/lib/storage/schema";
import {
  getLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  resetLoans,
} from "@/lib/storage/loans";

const validInput: Omit<Loan, "id" | "createdAt" | "updatedAt"> = {
  name: "학자금",
  principalRemaining: 12_000_000,
  annualInterestRate: 4.2,
  remainingMonths: 48,
  monthlyPayment: 270_000,
};

function seedLoans(items: Loan[]) {
  localStorage.setItem(LOANS_KEY, JSON.stringify({ version: 1, items }));
}

function makeLoan(id: string): Loan {
  return {
    id,
    name: `loan-${id}`,
    principalRemaining: 1_000_000,
    annualInterestRate: 5,
    remainingMonths: 24,
    monthlyPayment: 100_000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("packet-0002: Loans localStorage API", () => {
  it("AC-1: getLoans returns PARSE_ERROR on non-JSON value", () => {
    localStorage.setItem(LOANS_KEY, "NOT_JSON");
    const r = getLoans();
    expect(r).toEqual({ ok: false, error: "PARSE_ERROR" });
  });

  it("AC-1: getLoans returns PARSE_ERROR on valid JSON with wrong schema", () => {
    localStorage.setItem(LOANS_KEY, JSON.stringify({ version: 2, items: [] }));
    expect(getLoans()).toEqual({ ok: false, error: "PARSE_ERROR" });

    localStorage.setItem(LOANS_KEY, JSON.stringify({ version: 1, items: "nope" }));
    expect(getLoans()).toEqual({ ok: false, error: "PARSE_ERROR" });
  });

  it("AC-1: getLoans returns ok([]) when key is missing", () => {
    const r = getLoans();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });

  it("AC-2: createLoan rejects empty name with VALIDATION_ERROR and does not write", () => {
    const r = createLoan({ ...validInput, name: "" });
    expect(r).toEqual({ ok: false, error: "VALIDATION_ERROR" });
    expect(localStorage.getItem(LOANS_KEY)).toBeNull();
  });

  it("AC-2: createLoan enforces each numeric bound", () => {
    expect(createLoan({ ...validInput, principalRemaining: 0 }).ok).toBe(false);
    expect(createLoan({ ...validInput, principalRemaining: 2_000_000_001 }).ok).toBe(false);
    expect(createLoan({ ...validInput, annualInterestRate: 30.1 }).ok).toBe(false);
    expect(createLoan({ ...validInput, annualInterestRate: -1 }).ok).toBe(false);
    expect(createLoan({ ...validInput, remainingMonths: 0 }).ok).toBe(false);
    expect(createLoan({ ...validInput, remainingMonths: 601 }).ok).toBe(false);
    expect(createLoan({ ...validInput, monthlyPayment: 0 }).ok).toBe(false);
    expect(createLoan({ ...validInput, monthlyPayment: 50_000_001 }).ok).toBe(false);
    expect(localStorage.getItem(LOANS_KEY)).toBeNull();
  });

  it("AC-2: createLoan rejects when already at 200-item cap", () => {
    seedLoans(Array.from({ length: 200 }, (_, i) => makeLoan(`L${i}`)));
    const r = createLoan(validInput);
    expect(r).toEqual({ ok: false, error: "VALIDATION_ERROR" });
    const stored = JSON.parse(localStorage.getItem(LOANS_KEY)!);
    expect(stored.items).toHaveLength(200);
  });

  it("createLoan happy path: appends one with generated id/timestamps", () => {
    const r = createLoan(validInput);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.id).toBeTruthy();
      expect(r.value.createdAt).toBeTruthy();
      expect(r.value.updatedAt).toBeTruthy();
      expect(r.value.name).toBe("학자금");
    }
    const stored = JSON.parse(localStorage.getItem(LOANS_KEY)!);
    expect(stored).toMatchObject({ version: 1 });
    expect(stored.items).toHaveLength(1);
  });

  it("updateLoan: updates a field; NOT_FOUND for unknown id", () => {
    seedLoans([makeLoan("loan-1")]);
    const ok = updateLoan("loan-1", { monthlyPayment: 320_000 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.monthlyPayment).toBe(320_000);

    const nf = updateLoan("loan-404", { monthlyPayment: 1 });
    expect(nf).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("deleteLoan: removes existing; NOT_FOUND otherwise", () => {
    seedLoans([makeLoan("loan-1")]);
    expect(deleteLoan("loan-1")).toEqual({ ok: true, value: null });
    expect(JSON.parse(localStorage.getItem(LOANS_KEY)!).items).toHaveLength(0);
    expect(deleteLoan("loan-1")).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("getLoanById: NOT_FOUND when absent, ok when present", () => {
    seedLoans([makeLoan("loan-1")]);
    expect(getLoanById("loan-1").ok).toBe(true);
    expect(getLoanById("nope")).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("AC-3: resetLoans writes {version:1, items:[]}", () => {
    seedLoans([makeLoan("loan-1")]);
    expect(resetLoans()).toEqual({ ok: true, value: null });
    expect(JSON.parse(localStorage.getItem(LOANS_KEY)!)).toEqual({ version: 1, items: [] });
  });

  it("AC-4: createLoan returns QUOTA_EXCEEDED when setItem throws quota", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    // Polyfilled (non-jsdom) Storage may not derive from Storage.prototype; spy the instance too.
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const r = createLoan(validInput);
    expect(r).toEqual({ ok: false, error: "QUOTA_EXCEEDED" });
  });
});
