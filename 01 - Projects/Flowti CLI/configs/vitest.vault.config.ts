import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		root: "..",
		include: ["tests/vault-journeys/**/*.test.ts"],
		pool: "forks",
		poolOptions: { forks: { isolate: true } },
		fileParallelism: true,
		globals: true,
		testTimeout: 60_000,
		hookTimeout: 60_000,
		teardownTimeout: 10_000,
		restoreMocks: true,
		clearMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
		reporters: [
			"default",
			["json", { outputFile: "reports/tests/vault-testreport.json" }],
		],
	},
});
