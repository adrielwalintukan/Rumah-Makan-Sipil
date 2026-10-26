import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  // Tes mengubah data bersama (buka/tutup toko, Habis), jadi dijalankan berurutan.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  // HP adalah perangkat utama (docs/design-system.md §1); 360 px = lebar HP terkecil yang didukung
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
