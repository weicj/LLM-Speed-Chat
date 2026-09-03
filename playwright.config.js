const { defineConfig } = require("@playwright/test");

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:18080",
    launchOptions: executablePath ? {executablePath} : {},
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
});
