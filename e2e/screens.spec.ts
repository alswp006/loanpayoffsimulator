import { test, expect, type Page } from "@playwright/test";

const TWO_LOANS = {
  version: 1,
  items: [
    { id: "a", name: "학자금", principalRemaining: 3_000_000, annualInterestRate: 3, remainingMonths: 48, monthlyPayment: 100_000, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "b", name: "카드론", principalRemaining: 7_000_000, annualInterestRate: 18, remainingMonths: 60, monthlyPayment: 150_000, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  ],
};

/** Seed localStorage before any app script runs. */
async function seedLoans(page: Page) {
  await page.addInitScript((data) => {
    window.localStorage.setItem("lps_loans_v1", JSON.stringify(data));
  }, TWO_LOANS);
}

test("home — summary header + loan list + tab bar", async ({ page }) => {
  await seedLoans(page);
  await page.goto("/");
  await expect(page.getByText("총 부채")).toBeVisible();
  await expect(page.getByText("10,000,000원")).toBeVisible();
  await expect(page).toHaveScreenshot("home.png");
});

test("loan form — empty fields show placeholders (regression: blank boxes)", async ({ page }) => {
  await page.goto("/loan/new");
  const inputs = page.getByRole("textbox");
  await expect(inputs.first()).toBeVisible();
  const count = await inputs.count();
  expect(count).toBe(5);
  // The exact bug guard: an empty box variant hides its label, so each field
  // MUST carry a non-empty placeholder or the user sees blank grey boxes.
  for (let i = 0; i < count; i++) {
    await expect(inputs.nth(i)).toHaveAttribute("placeholder", /.+/);
  }
  await expect(page).toHaveScreenshot("loanform-empty.png");
});

test("result — strategy cards + savings hero", async ({ page }) => {
  await seedLoans(page);
  await page.goto("/");
  await page.getByRole("button", { name: "시뮬레이션 시작" }).click();
  await page.getByRole("textbox").fill("300000");
  await page.getByRole("button", { name: "비교 결과 보기" }).click();
  await expect(page.getByText("비교 결과")).toBeVisible();
  await expect(page.getByText(/이자를 덜 내요|총 이자가 같아요/)).toBeVisible();
  await expect(page).toHaveScreenshot("result.png");
});

test("settings — tappable rows", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Snowball vs Avalanche")).toBeVisible();
  await expect(page).toHaveScreenshot("settings.png");
});
