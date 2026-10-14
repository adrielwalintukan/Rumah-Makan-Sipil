import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ milik Playwright
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
