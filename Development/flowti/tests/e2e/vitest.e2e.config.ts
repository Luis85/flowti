/**
 * Vitest config for E2E tests against a live Obsidian instance.
 *
 * Standalone config — does NOT extend the main vitest.config.ts:
 *   - No obsidian stub alias (E2E tests talk to real Obsidian via CLI)
 *   - Serial execution (vault mutations must not interleave)
 *   - Longer timeouts (CLI round-trips take 2-5s each)
 *   - Alphabetical file sequencer (00- → 10- → 30-)
 *   - JSON reporter alongside verbose for E2E report generation
 *   - bail: 1 — stops the suite on first failure (prerequisites gate everything)
 *
 * Execution order:
 *   Chapter 1: 00-prerequisites  (CLI, plugin health, EventBus, vault ops)
 *   Chapter 2: 10-installer      (wizard modal flow, artifact verification)
 *   Chapter 3: 30-journey-*      (user journeys — Getting Started, etc.)
 *
 * Usage:
 *   npx vitest run --config tests/e2e/vitest.e2e.config.ts
 */
import { defineConfig } from "vitest/config";
import * as path from "path";
import { AlphabeticalSequencer } from "./helpers/sequencer";

export default defineConfig({
	resolve: {
		alias: {
			src: path.resolve(__dirname, "../../src"),
		},
	},
	test: {
		globalSetup: ["tests/e2e/globalSetup.ts", "tests/e2e/globalTeardown.ts"],
		include: ["tests/e2e/**/*.test.ts"],
		environment: "node",
		sequence: {
			concurrent: false,
			sequencer: AlphabeticalSequencer,
		},
		fileParallelism: false,
		bail: 1,
		testTimeout: 30_000,
		hookTimeout: 60_000,
		retry: 1,
		reporters: ["verbose", "json"],
		outputFile: {
			json: "docs/reports/e2e/e2e-results.json",
		},
	},
});
