import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		root: path.resolve(import.meta.dirname, ".."),
		include: ["tests/**/*.test.ts"],
		exclude: ["tests/e2e/**"],
		globals: true,
		environment: "node",
		testTimeout: 10_000,
		hookTimeout: 10_000,
		teardownTimeout: 5_000,
		pool: "forks",
		fileParallelism: true,
		isolate: true,
		restoreMocks: true,
		clearMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
		passWithNoTests: false,
		reporters: ["default"],
		outputFile: {
			json: "reports/tests/testreport.json",
		},
		sequence: {
			shuffle: false,
		},
		coverage: {
			enabled: false,
			clean: false,
			provider: "v8",
			reportsDirectory: "reports/coverage",
			reporter: ["json", "text"],
			include: ["src/**/*.ts"],
			exclude: [
				"configs/vendor.d.ts",
				"src/**/*.d.ts",
				"src/**/*.stories.ts",
			],
			thresholds: {
				statements: 70,
				branches: 70,
				functions: 70,
				lines: 70,
			},
		},
	},
});
