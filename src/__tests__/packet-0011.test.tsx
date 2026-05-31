import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { Loan } from "@/lib/types";

mockAll();

const { useLoansStoreMock, useRunsStoreMock } = vi.hoisted(() => ({
  useLoansStoreMock: vi.fn(),
  useRunsStoreMock: vi.fn(),
}));
vi.mock("@/lib/store/loansStore", () => ({
  useLoansStore: useLoansStoreMock,
  LoansProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/store/runsStore", () => ({
  useRunsStore: useRunsStoreMock,
  RunsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import Simulate from "@/pages/Simulate";

function loan(id: string, principalRemaining: number, annualInterestRate: number, monthlyPayment: number): Loan {
  return {
    id, name: id, principalRemaining, annualInterestRate, remainingMonths: 60, monthlyPayment,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const okLoans = [loan("a", 1_000_000, 4, 100_000), loan("b", 2_000_000, 6, 100_000)];
const stallLoans = [loan("c", 10_000_000, 24, 100_000), loan("d", 9_000_000, 22, 100_000)];

let saveMock: ReturnType<typeof vi.fn>;

function setStores(loans: Loan[]) {
  useLoansStoreMock.mockReturnValue({
    loans, isHydrating: false, hydrateErrorCode: null,
    reload: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), reset: vi.fn(),
  });
  saveMock = vi.fn((run: { runId: string }) => ({ ok: true as const, value: run }));
  useRunsStoreMock.mockReturnValue({
    runs: [], isHydrating: false, hydrateErrorCode: null,
    reload: vi.fn(), save: saveMock, getRunById: vi.fn(), remove: vi.fn(), reset: vi.fn(),
  });
}

beforeEach(() => {
  mockNavigate.mockClear();
  useLoansStoreMock.mockReset();
  useRunsStoreMock.mockReset();
});

describe("packet-0011: Simulate (S3)", () => {
  it("AC-S3-1: fewer than 2 loans → guide + 대출 추가하러 가기, no compare CTA", () => {
    setStores([loan("a", 1_000_000, 4, 100_000)]);
    render(<Simulate />);
    expect(screen.getByText("대출이 2개 이상 있어야 비교할 수 있어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "비교 결과 보기" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "대출 추가하러 가기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/loan/new");
  });

  it("AC-S3-2: negative extra → field error, no run", () => {
    setStores(okLoans);
    render(<Simulate />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "비교 결과 보기" }));
    expect(screen.getByText("추가 상환 금액은 0원 이상이어야 해요")).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("AC-S3-3: shows 계산 중 and disables the button while computing", async () => {
    setStores(okLoans);
    render(<Simulate />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "비교 결과 보기" }));
    expect(screen.getByText("계산 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "비교 결과 보기" })).toBeDisabled();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled()); // flush deferred calc
  });

  it("AC-S3-5: ok build + ok save → navigates to /result with runId", async () => {
    setStores(okLoans);
    render(<Simulate />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "비교 결과 보기" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith("/result", { state: { runId: expect.any(String) } });
  });

  it("AC-S3-4: both strategies fail → AlertDialog, no save, no navigate", async () => {
    setStores(stallLoans);
    render(<Simulate />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "비교 결과 보기" }));
    expect(await screen.findByText("상환이 진행되지 않아요")).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("the extra-payment field has a placeholder (empty-field guidance)", () => {
    setStores(okLoans);
    render(<Simulate />);
    expect((screen.getByRole("textbox").getAttribute("placeholder") ?? "").length).toBeGreaterThan(0);
  });
});
