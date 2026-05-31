import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { Loan } from "@/lib/types";

mockAll();

const { useLoansStoreMock } = vi.hoisted(() => ({ useLoansStoreMock: vi.fn() }));
vi.mock("@/lib/store/loansStore", () => ({
  useLoansStore: useLoansStoreMock,
  LoansProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import Home from "@/pages/Home";
import { resetLoans } from "@/lib/storage/loans";
import { LOANS_KEY } from "@/lib/storage/schema";

function makeLoan(id: string): Loan {
  return {
    id, name: `대출 ${id}`, principalRemaining: 1_000_000, annualInterestRate: 5,
    remainingMonths: 24, monthlyPayment: 100_000,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function setStore(partial: Record<string, unknown>) {
  useLoansStoreMock.mockReturnValue({
    loans: [], isHydrating: false, hydrateErrorCode: null,
    reload: vi.fn(), create: vi.fn(), update: vi.fn(),
    remove: vi.fn(() => ({ ok: true, value: null })),
    reset: vi.fn(() => ({ ok: true, value: null })),
    ...partial,
  });
}

beforeEach(() => {
  mockNavigate.mockClear();
  useLoansStoreMock.mockReset();
});

describe("packet-0009: Home (S1)", () => {
  it("AC-1: while hydrating shows 불러오는 중 and disables main buttons", () => {
    setStore({ isHydrating: true });
    render(<Home />);
    expect(screen.getByText("불러오는 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "대출 추가" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "시뮬레이션 시작" })).toBeDisabled();
  });

  it("AC-2: empty → 대출 추가 visible, 0 loan rows", () => {
    setStore({ loans: [] });
    render(<Home />);
    expect(screen.getAllByRole("button", { name: "대출 추가" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("AC-3: one loan → 시뮬레이션 시작 disabled + guide text", () => {
    setStore({ loans: [makeLoan("l1")] });
    render(<Home />);
    expect(screen.getByRole("button", { name: "시뮬레이션 시작" })).toBeDisabled();
    expect(screen.getByText("대출을 1개 더 추가하면 전략 비교가 가능해요")).toBeInTheDocument();
  });

  it("two loans → 시뮬레이션 시작 enabled, navigates to /simulate", () => {
    setStore({ loans: [makeLoan("l1"), makeLoan("l2")] });
    render(<Home />);
    const cta = screen.getByRole("button", { name: "시뮬레이션 시작" });
    expect(cta).not.toBeDisabled();
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith("/simulate");
  });

  it("AC-4: PARSE_ERROR shows reset dialog; 초기화 resets storage to empty schema", () => {
    const reset = vi.fn(() => resetLoans());
    setStore({ hydrateErrorCode: "PARSE_ERROR", reset });
    render(<Home />);
    expect(screen.getByText("데이터를 불러올 수 없어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(LOANS_KEY)!)).toEqual({ version: 1, items: [] });
  });

  it("AC-5: tapping a loan row navigates to /loan/edit with loanId", () => {
    setStore({ loans: [makeLoan("l1")] });
    render(<Home />);
    fireEvent.click(screen.getByRole("listitem"));
    expect(mockNavigate).toHaveBeenCalledWith("/loan/edit", { state: { loanId: "l1" } });
  });

  it("delete flow: confirm dialog → remove → toast, without row navigation", () => {
    const remove = vi.fn(() => ({ ok: true as const, value: null }));
    setStore({ loans: [makeLoan("l1")], remove });
    render(<Home />);

    // per-row delete button opens the confirm dialog (must not navigate)
    const rowDelete = within(screen.getByRole("listitem")).getByRole("button", { name: "삭제" });
    fireEvent.click(rowDelete);
    expect(mockNavigate).not.toHaveBeenCalled();

    // confirm inside the dialog
    const dialog = screen.getByRole("alertdialog", { name: "대출을 삭제할까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(remove).toHaveBeenCalledWith("l1");
    expect(screen.getByText("삭제했어요")).toBeInTheDocument();
  });
});
