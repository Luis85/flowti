import { defineConfig } from "vitest/config";
import * as path from "path";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "./tests/mocks/obsidian-stub.ts"),
      "src/main": path.resolve(__dirname, "./tests/mocks/main-stub.ts"),
      // Add src alias for absolute imports
      src: path.resolve(__dirname, "./src")
    }
  },
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", "docs", "tests/e2e/**"],
    reporters: ["default", ["json", {
      outputFile: "docs/reports/tests/testreport.json"
    }]],
    coverage: {
      provider: "v8",
      reportsDirectory: "docs/reports/coverage/",
      reporter: ["text", "json"],
      exclude: ["tests/**", "src/modals/**"]
    },
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        },
        setupFiles: ['components/.storybook/vitest.setup.ts']
      }
    }]
  }
});