import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`menu principal acessível em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/setup");

    const menu = page.getByRole("button", { name: "Menu" });
    const navigation = page.getByRole("navigation", { name: "Principal" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(navigation).toBeHidden();

    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(navigation.getByRole("link")).toHaveCount(14);
    await expect(
      navigation.getByRole("link", { name: "Relatórios e histórico" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);

    await menu.click();
    await expect(navigation).toBeHidden();
  });
}

for (const width of [768, 1280]) {
  test(`navegação lateral visível em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/setup");

    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Principal" }).getByRole("link"),
    ).toHaveCount(14);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test("marca a rota atual e sua página filha", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/setup");
  const navigation = page.getByRole("navigation", { name: "Principal" });
  await page.getByRole("button", { name: "Menu" }).click();

  await page.evaluate(() => {
    window.history.pushState(null, "", "/ministros/importar");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    navigation.getByRole("link", { name: "Ministros", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);

  await page.evaluate(() => {
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    navigation.getByRole("link", { name: "Visão geral" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
});
