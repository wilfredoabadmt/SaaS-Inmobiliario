import { test, expect } from "@playwright/test";

test.describe("Public pages smoke test", () => {
  test("landing page renders successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Homya|Inmox|CRM/i);
  });

  test("login page renders with authentication form", async ({ page }) => {
    await page.goto("/login");
    const heading = page.getByRole("heading", { name: /iniciar sesión|acceder|bienvenido/i });
    await expect(heading).toBeVisible();
  });
});
