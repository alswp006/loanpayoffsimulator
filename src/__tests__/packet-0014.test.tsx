import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";

mockAll();

import Settings from "@/pages/Settings";

function tapRow(label: string) {
  const row = screen.getByText(label).closest('[role="listitem"]');
  expect(row).not.toBeNull();
  fireEvent.click(row as HTMLElement);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("packet-0014: Settings (S6)", () => {
  it("AC-1: renders ListRows immediately (static, no loading)", () => {
    render(<Settings />);
    expect(screen.queryByText("불러오는 중")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Snowball vs Avalanche")).toBeInTheDocument();
  });

  it("AC-2: strategy row opens a sheet with both strategy explanations", () => {
    render(<Settings />);
    tapRow("Snowball vs Avalanche");
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Snowball vs Avalanche")).toBeInTheDocument();
    expect(within(sheet).getByText(/Snowball: 잔액이 작은 대출부터/)).toBeInTheDocument();
    expect(within(sheet).getByText(/Avalanche: 금리가 높은 대출부터/)).toBeInTheDocument();
  });

  it("AC-3: input guide row opens a sheet with ranges + 2-loan constraint", () => {
    render(<Settings />);
    tapRow("입력 가이드");
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText(/0~30%/)).toBeInTheDocument();
    expect(within(sheet).getByText(/1~600개월/)).toBeInTheDocument();
    expect(within(sheet).getByText("대출이 2개 이상 있어야 비교할 수 있어요")).toBeInTheDocument();
  });

  it("AC-4: closing the sheet keeps the page and allows reopening", () => {
    render(<Settings />);
    tapRow("Snowball vs Avalanche");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // page still here → reopen
    tapRow("Snowball vs Avalanche");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("S6-AC-3: never calls window.open (no external navigation)", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Settings />);
    tapRow("Snowball vs Avalanche");
    tapRow("입력 가이드");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
