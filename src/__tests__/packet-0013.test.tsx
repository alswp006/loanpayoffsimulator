import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import type { Loan, SimulationRun, StrategySummary } from "@/lib/types";
import { buildSimulationRun } from "@/lib/simulation/buildSimulationRun";

// mockAll includes mockTossRewardAd: the reward gate renders its children and
// fires onRewarded, so unlock side-effects run deterministically.
mockAll();

const { useRunsStoreMock, useRewardUnlocksStoreMock } = vi.hoisted(() => ({
  useRunsStoreMock: vi.fn(),
  useRewardUnlocksStoreMock: vi.fn(),
}));
vi.mock("@/lib/store/runsStore", () => ({
  useRunsStore: useRunsStoreMock,
  RunsProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/store/rewardUnlocksStore", () => ({
  useRewardUnlocksStore: useRewardUnlocksStoreMock,
  RewardUnlocksProvider: ({ children }: { children: ReactNode }) => children,
}));

import Schedule from "@/pages/Schedule";

function loan(id: string, principalRemaining: number, monthlyPayment: number): Loan {
  return {
    id, name: id, principalRemaining, annualInterestRate: 0, remainingMonths: 600, monthlyPayment,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function buildRun(loans: Loan[]): SimulationRun {
  const r = buildSimulationRun(loans, 0, { nowISO: "2026-01-01T00:00:00.000Z" });
  if (!r.ok) throw new Error("expected ok run");
  return r.value;
}

const smallRun = buildRun([loan("a", 300_000, 100_000), loan("b", 300_000, 100_000)]); // ~3 rows
const bigRun = buildRun([loan("a", 13_000_000, 100_000), loan("b", 13_000_000, 100_000)]); // 130 rows

function errorSummary(): StrategySummary {
  return {
    strategy: "snowball", status: "error", errorCode: "MAX_MONTHS_REACHED",
    totalInterestPaid: 0, totalPrincipalPaid: 0, totalPaid: 0, monthsToPayoff: 0, totalMonths: 0,
    payoffDateISO: "", monthlySavingsVsOtherByInterest: 0,
  };
}
const errorRun: SimulationRun = { ...smallRun, summaries: { ...smallRun.summaries, snowball: errorSummary() } };

let unlockMock: ReturnType<typeof vi.fn>;
function setStores(lookup: unknown, unlockedIds: string[] = [], isHydrating = false) {
  useRunsStoreMock.mockReturnValue({
    runs: [], isHydrating, hydrateErrorCode: null,
    reload: vi.fn(), save: vi.fn(), getRunById: vi.fn(() => lookup), remove: vi.fn(), reset: vi.fn(),
  });
  unlockMock = vi.fn(() => ({ ok: true, value: null }));
  useRewardUnlocksStoreMock.mockReturnValue({
    unlockedRunIds: unlockedIds, isHydrating: false, hydrateErrorCode: null,
    reload: vi.fn(), unlock: unlockMock, isUnlocked: (id: string) => unlockedIds.includes(id),
  });
}

beforeEach(() => {
  mockNavigate.mockClear();
  useRunsStoreMock.mockReset();
  useRewardUnlocksStoreMock.mockReset();
  mockLocation.state = null as never;
});

describe("packet-0013: Schedule (S5)", () => {
  it("AC-S5-3: missing runId → can't open + 시뮬레이션으로", () => {
    mockLocation.state = null as never;
    setStores(null);
    render(<Schedule />);
    expect(screen.getByText("스케줄을 열 수 없어요")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "시뮬레이션으로" }));
    expect(mockNavigate).toHaveBeenCalledWith("/simulate");
  });

  it("AC-S5-4: NOT_FOUND → Expired + 시뮬레이션으로", () => {
    mockLocation.state = { runId: "gone", strategy: "snowball" } as never;
    setStores({ ok: false, error: "NOT_FOUND" });
    render(<Schedule />);
    expect(screen.getByText("결과가 만료되었어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "시뮬레이션으로" }));
    expect(mockNavigate).toHaveBeenCalledWith("/simulate");
  });

  it("AC-S5-5: strategy error → message instead of table", () => {
    mockLocation.state = { runId: "run-1", strategy: "snowball" } as never;
    setStores({ ok: true, value: errorRun }, ["run-1"]);
    render(<Schedule />);
    expect(screen.getByText("이 전략은 계산에 실패해서 스케줄을 만들 수 없어요")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("AC-S5-2: reward gate fires onRewarded → unlock(runId) and reveals rows", async () => {
    mockLocation.state = { runId: "run-1", strategy: "snowball" } as never;
    setStores({ ok: true, value: smallRun }, []); // not unlocked → wrapped in reward gate
    render(<Schedule />);
    await waitFor(() => expect(unlockMock).toHaveBeenCalledWith("run-1"));
    expect(screen.queryAllByRole("listitem").length).toBeGreaterThanOrEqual(1);
  });

  it("already unlocked → table shown without the ad gate", () => {
    mockLocation.state = { runId: "run-1", strategy: "snowball" } as never;
    setStores({ ok: true, value: smallRun }, ["run-1"]);
    render(<Schedule />);
    expect(screen.queryByRole("button", { name: "광고 보고 보기" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("listitem").length).toBeGreaterThanOrEqual(1);
  });

  it("AC-S5-6: >120 rows → windowed list with <= 30 initial DOM rows", () => {
    mockLocation.state = { runId: "run-1", strategy: "snowball" } as never;
    setStores({ ok: true, value: bigRun }, ["run-1"]);
    render(<Schedule />);
    expect(screen.getByTestId("virtual-list")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem").length).toBeLessThanOrEqual(30);
  });
});
