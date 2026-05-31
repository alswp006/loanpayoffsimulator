import { describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";

mockAll();

import { MainTabBar } from "@/components/MainTabBar";

function renderAt(pathname: string) {
  mockLocation.pathname = pathname;
  return render(<MainTabBar />);
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockLocation.pathname = "/";
});

describe("packet-0016: MainTabBar + safe-area", () => {
  it("AC-1: shown on tab roots; tapping 설정 navigates to /settings", () => {
    renderAt("/");
    const tabbar = screen.getByTestId("main-tabbar");
    expect(within(tabbar).getByRole("button", { name: "대출" })).toBeInTheDocument();
    fireEvent.click(within(tabbar).getByRole("button", { name: "설정" }));
    expect(mockNavigate).toHaveBeenCalledWith("/settings");
  });

  it("AC-2: fixed tab bar includes safe-area-inset-bottom padding", () => {
    renderAt("/");
    const style = screen.getByTestId("main-tabbar").getAttribute("style") ?? "";
    expect(style).toContain("env(safe-area-inset-bottom)");
    expect(style).toContain("fixed");
  });

  it("hidden on sub-routes (no overlap with fixed CTAs)", () => {
    renderAt("/loan/new");
    expect(screen.queryByTestId("main-tabbar")).not.toBeInTheDocument();
  });

  it("current tab is marked aria-current and does not self-navigate", () => {
    renderAt("/settings");
    const tabbar = screen.getByTestId("main-tabbar");
    expect(within(tabbar).getByRole("button", { name: "설정" })).toHaveAttribute("aria-current", "page");
    expect(within(tabbar).getByRole("button", { name: "대출" })).not.toHaveAttribute("aria-current");
    fireEvent.click(within(tabbar).getByRole("button", { name: "설정" }));
    expect(mockNavigate).not.toHaveBeenCalled(); // current tab is a no-op
  });
});
