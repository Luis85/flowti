/**
 * 10-journey-getting-started.test.ts — E2E: Getting Started journey.
 *
 * Executes the getting-started.journey definition against the Flowti CLI.
 * Tests the full flow: bootstrap → scaffold → components → journey → health.
 *
 * This file auto-runs all journey steps AND is open for developer expansion.
 * Add custom tests below the auto-generated section.
 *
 * Run: npx vitest run tests/e2e/10-journey-getting-started.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
	loadJourney,
	runStep,
	runJourney,
} from "../../src/domain/e2e/journey/index.js";
import type { JourneyExecutorOptions } from "../../src/domain/e2e/journey/index.js";
import { createDefaultDeps } from "../../src/infrastructure/deps.js";

// ── Configuration ───────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const deps = createDefaultDeps();
const journey = loadJourney(import.meta.dirname, "getting-started", deps);

const opts: JourneyExecutorOptions = {
	cwd: PROJECT_ROOT,
	commandTimeout: 60000,
	variables: {
		projectRoot: PROJECT_ROOT,
	},
};

// ── Setup / Teardown ────────────────────────────────────────────────

beforeAll(() => {
	// Ensure CLI is built before running E2E tests
	if (!fs.existsSync(path.join(PROJECT_ROOT, "dist", "main.js"))) {
		execSync("npm run build:cli", { cwd: PROJECT_ROOT, stdio: "pipe" });
	}
});

afterAll(() => {
	// Clean up scaffolded test-app if it was created
	const testAppDir = path.join(PROJECT_ROOT, "test-app");
	if (fs.existsSync(testAppDir)) {
		fs.rmSync(testAppDir, { recursive: true, force: true });
	}
});

// ── Auto-generated step tests ───────────────────────────────────────
// Each step from the journey definition becomes its own test.
// The journey executor handles tool dispatch — steps fail fast on
// the first broken action.

describe(`Journey: ${journey.journey}`, () => {
	for (const step of journey.steps) {
		it(step.title, async () => {
			const result = await runStep(step, opts);
			expect(result.status, `Step "${step.title}" failed: ${result.error}`).toBe("pass");
		});
	}

	// ── Full journey run (aggregate) ────────────────────────────────
	// Runs all steps sequentially and verifies the overall result.

	it("complete journey passes end-to-end", async () => {
		const result = await runJourney(journey, opts);
		expect(result.failed, `${result.failed} step(s) failed`).toBe(0);
		expect(result.passed).toBe(result.totalSteps);
	});

	// ── Developer-extensible section ────────────────────────────────
	// Add custom tests below. These run alongside the auto-generated
	// step tests and can access the same journey definition.
	//
	// Examples:
	//   it("custom: verify scaffolded README", () => { ... });
	//   it("custom: check generated config schema", () => { ... });
});
