import { expect, test, type Page } from "@playwright/test";

// The everyday paths, checked in a real browser on every pull request.

async function signInDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await page.waitForURL("**/log**");
}

test("diary loads and water updates instantly", async ({ page }) => {
  await signInDemo(page);
  await page.getByRole("navigation").getByText("Diary").click();
  await expect(page.getByRole("heading", { name: "Diary" })).toBeVisible();
  const water = page.getByRole("region", { name: "Water" });
  const before = await water.locator("p").first().innerText();
  await water.getByRole("button", { name: /Add (8 oz|250 ml)/ }).click();
  await expect(water.locator("p").first()).not.toHaveText(before);
});

test("log a set in a workout and finish it", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.waitForURL("**/train/workout/**");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("pec deck");
  await page.getByRole("dialog").locator("li button").nth(1).click(); // first result after "Create …"
  await page.getByRole("button", { name: /^Add 1 exercise$/ }).click();
  await page.getByLabel("Set 1 weight").fill("100");
  await page.getByLabel("Set 1 reps").fill("12");
  await page.getByRole("button", { name: "Mark set 1 done" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForURL("**/train/history/**");
  await expect(page.getByText("Pec Deck").first()).toBeVisible();
});

test("log cardio and see it in the diary", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/train/cardio/new");
  await page.getByLabel("Search activities").fill("hacky");
  await page.getByRole("button", { name: /Hacky sack/ }).click();
  await page.locator("input[inputmode=numeric]").first().fill("20");
  const weight = page.getByLabel(/Your weight/);
  if (await weight.isVisible()) await weight.fill("170");
  await page.getByRole("button", { name: "Log it" }).click();
  await page.waitForURL("**/diary**");
  await expect(page.getByRole("region", { name: "Exercise" }).getByText("Hacky sack").first()).toBeVisible();
});

test("unknown pages show a friendly 404", async ({ page }) => {
  await page.goto("/definitely-not-a-page");
  await expect(page.getByText("Nothing on this rack")).toBeVisible();
});
