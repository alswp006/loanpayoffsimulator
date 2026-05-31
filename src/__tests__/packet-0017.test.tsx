import { describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";

mockAll();

import App from "@/App";

const NAVIGATE_TARGETS = ["/", "/loan/new", "/loan/edit", "/simulate", "/result", "/schedule", "/settings"];

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

describe("packet-0017: integration wiring", () => {
  it("AC-1/AC-2: App.tsx defines a Route for every navigate() target", () => {
    const appSrc = readFileSync("src/App.tsx", "utf8");
    for (const target of NAVIGATE_TARGETS) {
      expect(appSrc).toContain(`path="${target}"`);
    }
  });

  it("AC-3: main.tsx keeps the TDSMobileAITProvider/BrowserRouter anchors", () => {
    const mainSrc = readFileSync("src/main.tsx", "utf8");
    expect(mainSrc).toContain("TDSMobileAITProvider");
    expect(mainSrc).toContain("BrowserRouter");
  });

  it("AC-4: '/' renders Home without crashing", () => {
    renderAt("/");
    expect(screen.getByText("대출 비교")).toBeInTheDocument();
  });

  it("AC-2: every navigate target renders a non-empty page", () => {
    for (const target of NAVIGATE_TARGETS) {
      const { unmount } = renderAt(target);
      // A matched route renders a Top nav; an unmatched route would render nothing.
      expect(screen.getAllByRole("navigation").length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });
});
