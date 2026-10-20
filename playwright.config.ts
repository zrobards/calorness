import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke tests: a real browser clicking through the app against a
// real (test) database. Run with `npm run e2e` after `npm run build`.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", ...devices["iPhone 14"], browserName: "chromium" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
