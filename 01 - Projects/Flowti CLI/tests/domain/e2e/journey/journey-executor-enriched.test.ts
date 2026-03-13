import { describe, it, expect, vi } from "vitest";
import {
	shouldSkipStep,
	sequenceJourneys,
	filterJourneysByType,
	filterJourneysByRisk,
	executeJourney,
} from "../../../../src/domain/e2e/journey/journey-executor.js";
import type { ToolDeps, ResolvedEnvironment } from "../../../../src/domain/e2e/journey/journey-executor.js";
import type {
	JourneyStep,
	JourneyDefinition,
	JourneyExecutorOptions,
	RiskLevel,
	ActionResult,
} from "../../../../src/domain/e2e/journey/journey-types.js";

// ── Fixtures ────────────────────────────────────────────────────────

function makeStep(overrides: Partial<JourneyStep> = {}): JourneyStep {
	return {
		id: "s1",
		title: "Default Step",
		description: "A test step",
		actions: [{ tool: "log", message: "hi" }],
		...overrides,
	};
}

function makeJourney(overrides: Partial<JourneyDefinition> = {}): JourneyDefinition {
	return {
		journey: "Test Journey",
		description: "A test journey",
		steps: [makeStep()],
		...overrides,
	};
}

function makeDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
	let time = 0;
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => true),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		clock: { ms: () => time++ },
		...overrides,
	};
}

function makeEnv(toolResult: Partial<ActionResult> = {}): ResolvedEnvironment {
	return {
		tools: {
			log: () => ({
				tool: "log",
				success: true,
				durationMs: 0,
				...toolResult,
			}),
		},
	};
}

function makeFailEnv(): ResolvedEnvironment {
	return {
		tools: {
			log: () => ({
				tool: "log",
				success: false,
				error: "boom",
				durationMs: 0,
			}),
		},
	};
}

// ── shouldSkipStep ──────────────────────────────────────────────────

describe("shouldSkipStep", () => {
	it("skips when skip=true", () => {
		const step = makeStep({ skip: true });
		const result = shouldSkipStep(step, {});
		expect(result.skip).toBe(true);
		expect(result.reason).toBe("skip=true");
	});

	it("does not skip a normal step", () => {
		const step = makeStep();
		expect(shouldSkipStep(step, {}).skip).toBe(false);
	});

	it("skips dev-only steps when devMode is false", () => {
		const step = makeStep({ dev: true });
		const result = shouldSkipStep(step, { devMode: false });
		expect(result.skip).toBe(true);
		expect(result.reason).toContain("dev-only");
	});

	it("does not skip dev-only steps when devMode is true", () => {
		const step = makeStep({ dev: true });
		expect(shouldSkipStep(step, { devMode: true }).skip).toBe(false);
	});

	it("skips dev-only steps when devMode is not set (defaults false)", () => {
		const step = makeStep({ dev: true });
		expect(shouldSkipStep(step, {}).skip).toBe(true);
	});

	it("skips steps not in stepFilter", () => {
		const step = makeStep({ id: "step-a" });
		const result = shouldSkipStep(step, { stepFilter: ["step-b", "step-c"] });
		expect(result.skip).toBe(true);
		expect(result.reason).toContain("filtered");
	});

	it("does not skip steps that match stepFilter", () => {
		const step = makeStep({ id: "step-b" });
		expect(shouldSkipStep(step, { stepFilter: ["step-b"] }).skip).toBe(false);
	});

	it("does not filter when stepFilter is empty", () => {
		const step = makeStep({ id: "step-a" });
		expect(shouldSkipStep(step, { stepFilter: [] }).skip).toBe(false);
	});

	describe("runIf condition", () => {
		it("skips when runIf variable is empty/missing", () => {
			const step = makeStep({ condition: { runIf: "{{enabled}}" } });
			const result = shouldSkipStep(step, { variables: {} });
			expect(result.skip).toBe(true);
			expect(result.reason).toContain("runIf");
		});

		it("does not skip when runIf variable is truthy", () => {
			const step = makeStep({ condition: { runIf: "{{enabled}}" } });
			expect(shouldSkipStep(step, { variables: { enabled: "yes" } }).skip).toBe(false);
		});

		it("skips when runIf variable is 'false'", () => {
			const step = makeStep({ condition: { runIf: "{{flag}}" } });
			expect(shouldSkipStep(step, { variables: { flag: "false" } }).skip).toBe(true);
		});

		it("skips when runIf variable is '0'", () => {
			const step = makeStep({ condition: { runIf: "{{flag}}" } });
			expect(shouldSkipStep(step, { variables: { flag: "0" } }).skip).toBe(true);
		});
	});

	describe("skipIf condition", () => {
		it("skips when skipIf variable is truthy", () => {
			const step = makeStep({ condition: { skipIf: "{{ci}}" } });
			const result = shouldSkipStep(step, { variables: { ci: "true" } });
			expect(result.skip).toBe(true);
			expect(result.reason).toContain("skipIf");
		});

		it("does not skip when skipIf variable is empty", () => {
			const step = makeStep({ condition: { skipIf: "{{ci}}" } });
			expect(shouldSkipStep(step, { variables: {} }).skip).toBe(false);
		});

		it("does not skip when skipIf variable is 'false'", () => {
			const step = makeStep({ condition: { skipIf: "{{ci}}" } });
			expect(shouldSkipStep(step, { variables: { ci: "false" } }).skip).toBe(false);
		});
	});

	it("evaluates skip=true before conditions", () => {
		const step = makeStep({ skip: true, condition: { runIf: "{{always}}" } });
		const result = shouldSkipStep(step, { variables: { always: "yes" } });
		expect(result.skip).toBe(true);
		expect(result.reason).toBe("skip=true");
	});
});

// ── sequenceJourneys ────────────────────────────────────────────────

describe("sequenceJourneys", () => {
	const journeyA = makeJourney({ journey: "Alpha", chapter: 3 });
	const journeyB = makeJourney({ journey: "Beta", chapter: 1 });
	const journeyC = makeJourney({ journey: "Charlie", chapter: 2 });

	it("sorts by chapter-order (default)", () => {
		const result = sequenceJourneys([journeyA, journeyB, journeyC], "chapter-order");
		expect(result.map((j) => j.journey)).toEqual(["Beta", "Charlie", "Alpha"]);
	});

	it("sorts alphabetically", () => {
		const result = sequenceJourneys([journeyC, journeyA, journeyB], "alphabetical");
		expect(result.map((j) => j.journey)).toEqual(["Alpha", "Beta", "Charlie"]);
	});

	it("sorts by risk-priority", () => {
		const critical = makeJourney({
			journey: "Critical",
			traceability: { risk: "critical" as RiskLevel },
		});
		const low = makeJourney({
			journey: "Low",
			traceability: { risk: "low" as RiskLevel },
		});
		const high = makeJourney({
			journey: "High",
			traceability: { risk: "high" as RiskLevel },
		});
		const noRisk = makeJourney({ journey: "NoRisk" });

		const result = sequenceJourneys([low, noRisk, critical, high], "risk-priority");
		expect(result.map((j) => j.journey)).toEqual(["Critical", "High", "Low", "NoRisk"]);
	});

	it("risk-priority uses chapter as tiebreaker", () => {
		const a = makeJourney({
			journey: "A",
			chapter: 5,
			traceability: { risk: "high" as RiskLevel },
		});
		const b = makeJourney({
			journey: "B",
			chapter: 2,
			traceability: { risk: "high" as RiskLevel },
		});

		const result = sequenceJourneys([a, b], "risk-priority");
		expect(result.map((j) => j.journey)).toEqual(["B", "A"]);
	});

	it("does not mutate the original array", () => {
		const original = [journeyA, journeyB, journeyC];
		const copy = [...original];
		sequenceJourneys(original, "alphabetical");
		expect(original).toEqual(copy);
	});

	it("handles journeys with no chapter (defaults to 999)", () => {
		const withChapter = makeJourney({ journey: "With", chapter: 1 });
		const without = makeJourney({ journey: "Without" });

		const result = sequenceJourneys([without, withChapter], "chapter-order");
		expect(result.map((j) => j.journey)).toEqual(["With", "Without"]);
	});
});

// ── filterJourneysByType ────────────────────────────────────────────

describe("filterJourneysByType", () => {
	const smoke = makeJourney({ journey: "Smoke", type: "smoke" });
	const regression = makeJourney({ journey: "Regression", type: "regression" });
	const functional = makeJourney({ journey: "Functional", type: "functional" });
	const noType = makeJourney({ journey: "NoType" });

	it("filters to matching types", () => {
		const result = filterJourneysByType([smoke, regression, functional, noType], ["smoke", "regression"]);
		expect(result.map((j) => j.journey)).toEqual(["Smoke", "Regression"]);
	});

	it("excludes journeys with no type", () => {
		const result = filterJourneysByType([noType], ["smoke"]);
		expect(result).toHaveLength(0);
	});

	it("returns empty when no types match", () => {
		const result = filterJourneysByType([smoke], ["performance"]);
		expect(result).toHaveLength(0);
	});

	it("returns all matching journeys", () => {
		const result = filterJourneysByType([smoke, functional], ["smoke", "functional"]);
		expect(result).toHaveLength(2);
	});
});

// ── filterJourneysByRisk ────────────────────────────────────────────

describe("filterJourneysByRisk", () => {
	const critical = makeJourney({ journey: "C", traceability: { risk: "critical" } });
	const high = makeJourney({ journey: "H", traceability: { risk: "high" } });
	const low = makeJourney({ journey: "L", traceability: { risk: "low" } });
	const noRisk = makeJourney({ journey: "N" });

	it("filters to matching risk levels", () => {
		const result = filterJourneysByRisk([critical, high, low, noRisk], ["critical", "high"]);
		expect(result.map((j) => j.journey)).toEqual(["C", "H"]);
	});

	it("excludes journeys with no traceability", () => {
		const result = filterJourneysByRisk([noRisk], ["critical"]);
		expect(result).toHaveLength(0);
	});

	it("excludes journeys with traceability but no risk", () => {
		const withTrace = makeJourney({ journey: "T", traceability: { requirements: ["REQ-1"] } });
		const result = filterJourneysByRisk([withTrace], ["critical"]);
		expect(result).toHaveLength(0);
	});
});

// ── executeJourney — retry logic ────────────────────────────────────

describe("executeJourney — retry", () => {
	it("retries a failing step up to maxAttempts", async () => {
		let callCount = 0;
		const env: ResolvedEnvironment = {
			tools: {
				log: () => {
					callCount++;
					if (callCount < 3) return { tool: "log", success: false, error: "flaky", durationMs: 0 };
					return { tool: "log", success: true, durationMs: 0 };
				},
			},
		};

		const journey = makeJourney({
			steps: [makeStep({ retry: { maxAttempts: 3, delayMs: 0 } })],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, {}, env);

		expect(result.passed).toBe(1);
		expect(result.failed).toBe(0);
		expect(result.steps[0].retryAttempts).toBe(2);
	});

	it("fails after exhausting all retry attempts", async () => {
		const env: ResolvedEnvironment = {
			tools: {
				log: () => ({ tool: "log", success: false, error: "always fails", durationMs: 0 }),
			},
		};

		const journey = makeJourney({
			steps: [makeStep({ retry: { maxAttempts: 2, delayMs: 0 } })],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, {}, env);

		expect(result.failed).toBe(1);
		expect(result.steps[0].retryAttempts).toBe(1);
	});

	it("calls sleep between retries when delayMs > 0", async () => {
		const sleepFn = vi.fn(async () => {});
		const env: ResolvedEnvironment = {
			tools: {
				log: () => ({ tool: "log", success: false, error: "fail", durationMs: 0 }),
			},
		};

		const journey = makeJourney({
			steps: [makeStep({ retry: { maxAttempts: 3, delayMs: 100 } })],
		});

		const deps = makeDeps({ sleep: sleepFn });
		await executeJourney(journey, deps, {}, env);

		expect(sleepFn).toHaveBeenCalledWith(100);
		expect(sleepFn).toHaveBeenCalledTimes(2);
	});
});

// ── executeJourney — bail after N failures ──────────────────────────

describe("executeJourney — bail", () => {
	it("skips remaining steps after N failures when bail is set", async () => {
		const env = makeFailEnv();
		const journey = makeJourney({
			steps: [
				makeStep({ id: "s1", title: "First" }),
				makeStep({ id: "s2", title: "Second" }),
				makeStep({ id: "s3", title: "Third" }),
			],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, { bail: 1 }, env);

		expect(result.steps[0].status).toBe("fail");
		expect(result.steps[1].status).toBe("skip");
		expect(result.steps[2].status).toBe("skip");
	});

	it("does not bail when bail=0 (unlimited)", async () => {
		const env = makeFailEnv();
		const journey = makeJourney({
			steps: [
				makeStep({ id: "s1", title: "First" }),
				makeStep({ id: "s2", title: "Second" }),
			],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, { bail: 0, continueOnFailure: true }, env);

		// Both should execute (not skipped due to bail)
		expect(result.steps[0].status).toBe("fail");
		expect(result.steps[1].status).toBe("fail");
	});
});

// ── executeJourney — dev mode ───────────────────────────────────────

describe("executeJourney — dev mode", () => {
	it("skips dev-only steps when devMode is off", async () => {
		const env = makeEnv();
		const journey = makeJourney({
			steps: [
				makeStep({ id: "normal", title: "Normal" }),
				makeStep({ id: "dev-step", title: "Dev Only", dev: true }),
			],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, { devMode: false }, env);

		expect(result.steps[0].status).toBe("pass");
		expect(result.steps[1].status).toBe("skip");
	});

	it("runs dev-only steps when devMode is on", async () => {
		const env = makeEnv();
		const journey = makeJourney({
			steps: [
				makeStep({ id: "dev-step", title: "Dev Only", dev: true }),
			],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, { devMode: true }, env);

		expect(result.steps[0].status).toBe("pass");
	});
});

// ── executeJourney — per-step timeout ───────────────────────────────

describe("executeJourney — per-step timeout", () => {
	it("forwards per-step timeout to tool executor", async () => {
		let receivedTimeout: number | undefined;
		const env: ResolvedEnvironment = {
			tools: {
				log: (_action, _deps, opts) => {
					receivedTimeout = opts.commandTimeout;
					return { tool: "log", success: true, durationMs: 0 };
				},
			},
		};

		const journey = makeJourney({
			steps: [makeStep({ timeout: 5000 })],
		});

		const deps = makeDeps();
		await executeJourney(journey, deps, { commandTimeout: 30000 }, env);

		expect(receivedTimeout).toBe(5000);
	});

	it("uses journey-level timeout when step has no timeout", async () => {
		let receivedTimeout: number | undefined;
		const env: ResolvedEnvironment = {
			tools: {
				log: (_action, _deps, opts) => {
					receivedTimeout = opts.commandTimeout;
					return { tool: "log", success: true, durationMs: 0 };
				},
			},
		};

		const journey = makeJourney({
			steps: [makeStep()],
		});

		const deps = makeDeps();
		await executeJourney(journey, deps, { commandTimeout: 15000 }, env);

		expect(receivedTimeout).toBe(15000);
	});
});

// ── executeJourney — result shape ───────────────────────────────────

describe("executeJourney — result shape", () => {
	it("returns correct counts and journey name", async () => {
		const env = makeEnv();
		const journey = makeJourney({
			journey: "My Journey",
			steps: [
				makeStep({ id: "s1", title: "Step 1" }),
				makeStep({ id: "s2", title: "Step 2", skip: true }),
			],
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, {}, env);

		expect(result.journeyName).toBe("My Journey");
		expect(result.totalSteps).toBe(2);
		expect(result.passed).toBe(1);
		expect(result.skipped).toBe(1);
		expect(result.failed).toBe(0);
	});

	it("copies traceability from definition to result", async () => {
		const env = makeEnv();
		const journey = makeJourney({
			traceability: {
				risk: "critical",
				requirements: ["REQ-001"],
			},
		});

		const deps = makeDeps();
		const result = await executeJourney(journey, deps, {}, env);

		expect(result.traceability?.risk).toBe("critical");
		expect(result.traceability?.requirements).toEqual(["REQ-001"]);
	});
});
