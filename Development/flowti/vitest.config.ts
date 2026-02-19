import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "./tests/mocks/obsidian-stub.ts"),
      "src/main": path.resolve(__dirname, "./tests/mocks/main-stub.ts"),
      // Add src alias for absolute imports
      src: path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", "docs"],
    reporters: [
      "dot",
      [
        "json",
        {
          outputFile: "docs/reports/tests/testreport.json",
        },
      ],
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "docs/reports/tests/",
      reporter: ["text", "json"],
      exclude: ["tests/**", "src/modals/**"],
    },
  },
});
