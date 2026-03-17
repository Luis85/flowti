/**
 * Flow 41 — Process Wiring & Quality Traceability integration tests.
 *
 * Verifies end-to-end flows across C60 features:
 * - Process compliance calculator → feature detail
 * - Journey executor retry + conditional steps
 * - Feature quality calculator → test history
 * - Lifecycle templates
 * - Journey feature field parsing
 */

import { describe, it, expect, vi } from "vitest";

// ── Process Compliance ──────────────────────────────────────

import { computeProcessCompliance } from "../../src/domain/process/complianceCalculator";
import { LIFECYCLE_PHASES } from "../../src/domain/process/types";

describe("Flow 41 — Process Compliance Integration", () => {
	it("computes full lifecycle compliance for a done feature", () => {
		const result = computeProcessCompliance({ name: "MVP", stage: "done" });
		expect(result.percentage).toBe(100);
		expect(result.steps).toHaveLength(LIFECYCLE_PHASES.length);
		expect(result.steps.every((s) => s.satisfied)).toBe(true);
		expect(result.processName).toBe("Development Lifecycle");
	});

	it("computes partial compliance for in-progress feature", () => {
		const result = computeProcessCompliance({ name: "Feature X", stage: "in-progress" });
		expect(result.percentage).toBe(60);
		expect(result.steps.filter((s) => s.satisfied)).toHaveLength(6);
		expect(result.steps.filter((s) => !s.satisfied)).toHaveLength(4);
	});

	it("each satisfied step has evidence string", () => {
		const result = computeProcessCompliance({ name: "F", stage: "approved" });
		for (const step of result.steps) {
			if (step.satisfied) {
				expect(step.evidence).toBeTruthy();
				expect(step.evidence).toContain("approved");
			} else {
				expect(step.evidence).toBeUndefined();
			}
		}
	});
});

// ── Journey Executor v2 (Retry + Conditional + Error) ──────

import { evaluateCondition, evaluateStepCondition } from "../../src/domain/journeyExecutor/conditionEvaluator";
import type { RetryConfig, ConditionalConfig, FailedActionContext } from "../../src/domain/journeyExecutor/types";

describe("Flow 41 — Executor v2 Integration", () => {
	it("condition evaluator handles complex variable expressions", () => {
		const vars = { env: "production", debug: "", feature: "MVP" };

		expect(evaluateCondition("{{env}}", vars)).toBe(true);
		expect(evaluateCondition("!{{debug}}", vars)).toBe(true);
		expect(evaluateCondition('{{env}} == "production"', vars)).toBe(true);
		expect(evaluateCondition('{{env}} != "staging"', vars)).toBe(true);
		expect(evaluateCondition('{{feature}} == "MVP"', vars)).toBe(true);
	});

	it("step condition precedence: skipIf over runIf", () => {
		const result = evaluateStepCondition(
			{ skipIf: "{{flag}}", runIf: "{{flag}}" },
			{ flag: "yes" },
		);
		expect(result.shouldRun).toBe(false);
		expect(result.reason).toContain("skipIf");
	});

	it("RetryConfig type shape is correct", () => {
		const config: RetryConfig = { maxRetries: 3, delayMs: 100, backoff: "exponential" };
		expect(config.maxRetries).toBe(3);
		expect(config.backoff).toBe("exponential");
	});

	it("ConditionalConfig type shape is correct", () => {
		const config: ConditionalConfig = { skipIf: "{{skip}}", runIf: "{{run}}" };
		expect(config.skipIf).toBe("{{skip}}");
		expect(config.runIf).toBe("{{run}}");
	});

	it("FailedActionContext captures tool info", () => {
		const ctx: FailedActionContext = { tool: "click", actionIndex: 2, params: { selector: ".btn" } };
		expect(ctx.tool).toBe("click");
		expect(ctx.actionIndex).toBe(2);
		expect(ctx.params?.selector).toBe(".btn");
	});
});

// ── Feature Quality + Test History ──────────────────────────

import { computeFeatureQuality, computeFeatureTestHistory } from "../../src/domain/testManagement/featureQualityCalculator";
import { parseJourneyDefinition } from "../../src/domain/testManagement/journeyParser";
import type { JourneyRegistryEntry } from "../../src/domain/testManagement/types";

function makeJourney(overrides: Partial<JourneyRegistryEntry> & { name: string }): JourneyRegistryEntry {
	return {
		type: "functional", actors: [], services: [], stepCount: 5, tools: [],
		jsonPath: "", complianceTags: [], runHistory: [], ...overrides,
	};
}

describe("Flow 41 — Feature Quality Integration", () => {
	it("end-to-end: quality + history for linked journeys", () => {
		const journeys = [
			makeJourney({ name: "Install Journey", feature: "MVP", runHistory: [
				{ date: "2026-03-04", totalSteps: 10, passed: 9, failed: 1, skipped: 0, durationMs: 500 },
				{ date: "2026-03-05", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 400 },
			]}),
			makeJourney({ name: "Hub Journey", feature: "MVP", lastRunResult:
				{ date: "2026-03-06", totalSteps: 8, passed: 7, failed: 1, skipped: 0, durationMs: 300 },
			}),
		];

		// Quality
		const quality = computeFeatureQuality(journeys, ["MVP"]);
		expect(quality).toHaveLength(1);
		const mvp = quality[0];
		expect(mvp.journeyCount).toBe(2);
		expect(mvp.passedSteps).toBe(17); // 10 + 7
		expect(mvp.failedSteps).toBe(1);  // 0 + 1
		expect(mvp.passRate).toBe(94);     // 17/18

		// History
		const history = computeFeatureTestHistory(journeys, "MVP");
		expect(history.entries).toHaveLength(3); // 2 from J1 + 1 from J2
		expect(history.dateGroups.length).toBeGreaterThanOrEqual(2);
		expect(history.entries[0].date).toBe("2026-03-06"); // Most recent
	});

	it("feature field parsed from journey JSON", () => {
		const result = parseJourneyDefinition({
			journey: "Test MVP",
			feature: "MVP - Product Lifecycle",
			steps: [{ id: "s1", actions: [{ tool: "command", id: "test" }] }],
		});
		expect(result).not.toBeNull();
		expect(result!.feature).toBe("MVP - Product Lifecycle");
	});
});

// ── Lifecycle Templates ─────────────────────────────────────

import { LIFECYCLE_TEMPLATES, generateBacklogReview, generateReview } from "../../src/domain/journeyBuilder/lifecycleTemplates";

describe("Flow 41 — Lifecycle Templates Integration", () => {
	it("all 5 templates generate valid journey structure", () => {
		for (const tmpl of LIFECYCLE_TEMPLATES) {
			const result = tmpl.generate("Test Feature");
			expect(result.journey).toContain(tmpl.label);
			expect(result.feature).toBe("Test Feature");
			expect(result.category).toBe("lifecycle");
			expect(result.steps.length).toBeGreaterThan(0);
			for (const step of result.steps) {
				expect(step.id).toBeTruthy();
				expect(step.actions.length).toBeGreaterThan(0);
			}
		}
	});

	it("backlog-review template includes verification steps", () => {
		const template = generateBacklogReview("My Feature");
		const tools = template.steps.flatMap((s) => s.actions.map((a) => a.tool));
		expect(tools).toContain("command");
		expect(tools).toContain("assert");
		expect(tools).toContain("manual");
		expect(tools).toContain("screenshot");
	});

	it("review template includes compliance check", () => {
		const template = generateReview("My Feature");
		const hasCompliance = template.steps.some((s) =>
			s.actions.some((a) => a.tool === "manual" && (a as { instruction?: string }).instruction?.includes("compliance")),
		);
		expect(hasCompliance).toBe(true);
	});
});
