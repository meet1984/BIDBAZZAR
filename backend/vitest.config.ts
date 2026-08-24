import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: { reporter: ["text", "html"] },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "tests/phase*.test.ts",
    ],
  },
});
