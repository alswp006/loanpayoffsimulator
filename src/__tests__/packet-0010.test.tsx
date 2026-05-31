import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import type { Loan } from "@/lib/types";

mockAll();

const { useLoansStoreMock } = vi.hoisted(() => ({ useLoansStoreMock: vi.fn() }));
vi.mock("@/lib/store/loansStore", () => ({
  useLoansStore: useLoansStoreMock,
  LoansProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import LoanForm from "@/pages/LoanForm";

function makeLoan(id: string): Loan {
  return {
    id, name: "학자금", principalRemaining: 12_000_000, annualInterestRate: 4.2,
    remainingMonths: 48, monthlyPayment: 270_000,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function setStore(partial: Record<string, unknown>) {
  useLoansStoreMock.mockReturnValue({
    loans: [], isHydrating: false, hydrateErrorCode: null,
    reload: vi.fn(),
    create: vi.fn(() => ({ ok: true, value: makeLoan("new1") })),
    update: vi.fn(() => ({ ok: true, value: makeLoan("l1") })),
    remove: vi.fn(), reset: vi.fn(),
    ...partial,
  });
}

function setLocation(pathname: string, state: unknown = null) {
  mockLocation.pathname = pathname;
  mockLocation.state = state as never;
}

function fillField(index: number, value: string) {
  fireEvent.change(screen.getAllByRole("textbox")[index], { target: { value } });
}

function fillValid() {
  fillField(0, "학자금");
  fillField(1, "12000000");
  fillField(2, "4.2");
  fillField(3, "48");
  fillField(4, "270000");
}

beforeEach(() => {
  mockNavigate.mockClear();
  useLoansStoreMock.mockReset();
  setLocation("/", null);
});

describe("packet-0010: LoanForm (S2)", () => {
  it("AC-S2-1: edit + hydrating shows 불러오는 중 and disables 저장", () => {
    setLocation("/loan/edit", { loanId: "l1" });
    setStore({ isHydrating: true });
    render(<LoanForm />);
    expect(screen.getByText("불러오는 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("AC-S2-2: edit with missing loanId shows dialog → 확인 navigates home", () => {
    setLocation("/loan/edit", null);
    setStore({ loans: [] });
    render(<LoanForm />);
    const dialog = screen.getByRole("alertdialog", { name: "대출을 찾을 수 없어요" });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0); // no form fields
    fireEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-S2-3: new + valid save → create called, navigates home with highlightLoanId", () => {
    setLocation("/loan/new", null);
    const create = vi.fn(() => ({ ok: true as const, value: makeLoan("new1") }));
    setStore({ create });
    render(<LoanForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/", { state: { highlightLoanId: "new1" } });
  });

  it("AC-S2-5: invalid rate shows field error and never touches storage", () => {
    setLocation("/loan/new", null);
    const create = vi.fn();
    setStore({ create });
    render(<LoanForm />);
    fillValid();
    fillField(2, "30.1"); // annualInterestRate out of range
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("연이율은 0%~30% 사이여야 해요")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("edit upsert: prefilled form, save calls update with the loan id", () => {
    setLocation("/loan/edit", { loanId: "l1" });
    const update = vi.fn(() => ({ ok: true as const, value: makeLoan("l1") }));
    setStore({ loans: [makeLoan("l1")], update });
    render(<LoanForm />);
    // prefilled name
    expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("학자금");
    fillField(4, "320000");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(update).toHaveBeenCalledWith("l1", expect.objectContaining({ monthlyPayment: 320_000 }));
  });

  it("every field has a placeholder (box variant hides its label while empty)", () => {
    setLocation("/loan/new", null);
    setStore({});
    render(<LoanForm />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(5);
    for (const input of inputs) {
      expect((input.getAttribute("placeholder") ?? "").length).toBeGreaterThan(0);
    }
  });
});
