import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression suite — catches presentation bugs that jsdom unit tests miss
 * (blank inputs, broken layout, white screen). Baselines live in e2e/__screenshots__.
 *
 *   npm run test:e2e          compare against baselines
 *   npm run test:e2e:update   regenerate baselines after an intentional UI change
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 },
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
