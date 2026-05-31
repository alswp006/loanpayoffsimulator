import { describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";

mockAll();

import App from "@/App";

// With the router mocked, <Routes> matches on mockLocation.pathname — set it per
// route so this stays deterministic regardless of test-suite ordering.
function renderAt(pathname: string) {
  mockLocation.pathname = pathname;
  mockLocation.state = null as never;
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockLocation.pathname = "/";
  mockLocation.state = null as never;
});

describe("packet-0015: App routing + provider wiring", () => {
  it("AC-1: '/' renders Home (providers resolve without throwing)", () => {
    renderAt("/");
    expect(screen.getByText("대출 비교")).toBeInTheDocument();
  });

  it("AC-2: '/loan/new' renders the loan form", () => {
    renderAt("/loan/new");
    expect(screen.getAllByText("대출 추가").length).toBeGreaterThanOrEqual(1);
  });

  it("AC-2: '/simulate' renders the simulation screen", () => {
    renderAt("/simulate");
    expect(screen.getByText("시뮬레이션")).toBeInTheDocument();
  });

  it("AC-2: '/result' (no state) renders the result screen without a routing error", () => {
    renderAt("/result");
    expect(screen.getByText("결과를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("AC-2: '/schedule' (no state) renders the schedule screen without a routing error", () => {
    renderAt("/schedule");
    expect(screen.getByText("스케줄을 열 수 없어요")).toBeInTheDocument();
  });

  it("AC-2/AC-3: '/settings' renders Settings (store providers in scope)", () => {
    renderAt("/settings");
    expect(screen.getAllByText("설정").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Snowball vs Avalanche")).toBeInTheDocument();
  });
});
