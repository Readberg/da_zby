import { defineConfig, devices } from "@playwright/test";

// `pnpm design:snap`: screenshots of /styleguide sections and key screens into docs/design/.
const PORT = 3006;

export default defineConfig({
  testDir: "./tests/design",
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/styleguide`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
