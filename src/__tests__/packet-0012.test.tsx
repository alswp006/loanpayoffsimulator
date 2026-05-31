import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { setClipboardText } from "@apps-in-toss/web-framework";
import type { SimulationRun, StrategySummary, StrategyType } from "@/lib/types";

mockAll();

const { useRunsStoreMock } = vi.hoisted(() => ({ useRunsStoreMock: vi.fn() }));
vi.mock("@/lib/store/runsStore", () => ({
  useRunsStore: useRunsStoreMock,
  RunsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import Result from "@/pages/Result";

function summary(strategy: StrategyType, status: "ok" | "error", interest: number, months: number, errorCode?: "MAX_MONTHS_REACHED" | "STALL_3_MONTHS"): StrategySummary {
  return {
    strategy, status, errorCode,
    totalInterestPaid: interest, totalPrincipalPaid: 20_000_000, totalPaid: interest + 20_000_000,
    monthsToPayoff: months, totalMonths: months, payoffDateISO: status === "ok" ? "2030-01-01" : "",
    monthlySavingsVsOtherByInterest: 0,
  };
}

const okRun: SimulationRun = {
  runId: "run-1", createdAt: "2026-01-01T00:00:00.000Z",
  input: { loanIds: ["a", "b"], extraMonthlyPayment: 100_000 },
  loanSnapshot: [],
  summaries: { snowball: summary("snowball", "ok", 2_100_000, 40), avalanche: summary("avalanche", "ok", 1_900_000, 39) },
  comparison: { interestDiff: 200_000, monthsDiff: 1, winnerByInterest: "avalanche" },
};

const errorRun: SimulationRun = {
  ...okRun,
  summaries: {
    snowball: summary("snowball", "error", 0, 0, "MAX_MONTHS_REACHED"),
    avalanche: summary("avalanche", "ok", 1_900_000, 39),
  },
  comparison: { interestDiff: 0, monthsDiff: 0, winnerByInterest: "tie" },
};

function setStore(opts: { isHydrating?: boolean; lookup?: unknown }) {
  useRunsStoreMock.mockReturnValue({
    runs: [], isHydrating: opts.isHydrating ?? false, hydrateErrorCode: null,
    reload: vi.fn(), save: vi.fn(),
    getRunById: vi.fn(() => opts.lookup),
    remove: vi.fn(), reset: vi.fn(),
  });
}

beforeEach(() => {
  mockNavigate.mockClear();
  vi.mocked(setClipboardText).mockClear();
  useRunsStoreMock.mockReset();
  mockLocation.state = null as never;
});

describe("packet-0012: Result (S4)", () => {
  it("AC-S4-1: while loading shows 불러오는 중 + disabled button", () => {
    setStore({ isHydrating: true });
    render(<Result />);
    expect(screen.getByText("불러오는 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상세 스케줄 보기" })).toBeDisabled();
  });

  it("AC-S4-2: missing runId → error + 시뮬레이션으로 navigates to /simulate", () => {
    mockLocation.state = null as never;
    setStore({ lookup: null });
    render(<Result />);
    expect(screen.getByText("결과를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryByText("결과가 만료되었어요")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "시뮬레이션으로" }));
    expect(mockNavigate).toHaveBeenCalledWith("/simulate");
  });

  it("AC-S4-3: runId present but NOT_FOUND → Expired message", () => {
    mockLocation.state = { runId: "run-x" } as never;
    setStore({ lookup: { ok: false, error: "NOT_FOUND" } });
    render(<Result />);
    expect(screen.getByText("결과를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByText("결과가 만료되었어요")).toBeInTheDocument();
  });

  it("AC-S4-1: success renders both interests, savings, and AdSlot between summary and detail", () => {
    mockLocation.state = { runId: "run-1" } as never;
    setStore({ lookup: { ok: true, value: okRun } });
    render(<Result />);
    expect(screen.getByText("총 이자 2,100,000원")).toBeInTheDocument();
    expect(screen.getByText("총 이자 1,900,000원")).toBeInTheDocument();
    expect(screen.getByText("Avalanche가 200,000원 이자를 덜 내요")).toBeInTheDocument();

    const summaryEl = screen.getByTestId("summary-section");
    const detailEl = screen.getByTestId("detail-section");
    const ad = document.querySelector('[data-ad-group-id="result-banner"]')!;
    expect(summaryEl.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ad.compareDocumentPosition(detailEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("AC-S4-4: error strategy shows 계산 실패 and disables its detail button", () => {
    mockLocation.state = { runId: "run-1" } as never;
    setStore({ lookup: { ok: true, value: errorRun } });
    render(<Result />);
    expect(screen.getByText("계산 실패")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snowball 상세 스케줄 보기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Avalanche 상세 스케줄 보기" })).not.toBeDisabled();
  });

  it("AC-S4-5: 결과 복사 copies to clipboard once", () => {
    mockLocation.state = { runId: "run-1" } as never;
    setStore({ lookup: { ok: true, value: okRun } });
    render(<Result />);
    fireEvent.click(screen.getByRole("button", { name: "결과 복사" }));
    expect(vi.mocked(setClipboardText)).toHaveBeenCalledTimes(1);
  });
});
