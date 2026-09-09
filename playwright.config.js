import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const executablePath =
  process.env.CHROMIUM_PATH || (existsSync(edge) ? edge : undefined);
const port = Number(process.env.AFTERLIGHT_PORT || 4179);
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 12000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "evidence/browser-results.json" }],
  ],
  use: {
    baseURL: process.env.AFTERLIGHT_TEST_URL || `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: { executablePath },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.AFTERLIGHT_TEST_URL
    ? undefined
    : {
        command: `npm run preview -- --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
        timeout: 30000,
      },
});
