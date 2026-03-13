import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadJourney, runStep, runJourney, setToolDeps, resetToolDeps, ensureTestVault } from "../../src/domain/e2e/journey/index.js";
import type { JourneyDefinition } from "../../src/domain/e2e/journey/index.js";

const projectRoot = import.meta.dirname + "/../..";
let journey: JourneyDefinition;

beforeAll(() => {
	ensureTestVault(projectRoot, "test-vault");
	journey = loadJourney(projectRoot, "getting-started");
});

afterAll(() => {
	resetToolDeps();
});

describe("Journey: getting-started", () => {
	// Auto-generated step tests from journey definition
	for (const step of journey?.steps ?? []) {
		it(`${step.id}: ${step.title}`, async () => {
			const result = await runStep(step, { cwd: projectRoot });
			expect(result.status).toBe("pass");
		});
	}

	// Full journey aggregate
	it("completes the full journey", async () => {
		const result = await runJourney(journey, { cwd: projectRoot });
		expect(result.failed).toBe(0);
	});
});

// ── Developer extensions ─────────────────────────────────────────────
// Add custom tests below. These run alongside the auto-generated steps
// and are preserved when the journey definition is updated.
//
// describe("Custom: getting-started", () => {
//   it("validates custom business logic", () => {
//     // your tests here
//   });
// });
