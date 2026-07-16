import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 60_000,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL: "http://localhost:3947",
  },
  webServer: {
    command: "pnpm build && pnpm start --port 3947",
    url: "http://localhost:3947",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
