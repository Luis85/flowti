import { describe, it, expect } from "vitest";
import {
	extractRequirementIds,
	extractUseCaseIds,
	extractUserStoryIds,
	validateTraceabilityLinks,
	buildTraceabilityMatrix,
	detectGaps,
	coverageByCategory,
	type RequirementRef,
} from "../../../src/domain/review/traceability.js";
import type { JourneyDefinition, JourneyResult, StepResult } from "../../../src/domain/e2e/journey/journey-types.js";

// ── Fixtures ─────────────────────────────────────────────────────────

function makeJourney(overrides: Partial<JourneyDefinition> = {}): JourneyDefinition {
	return {
		journey: "test-journey",
		description: "A test journey",
		steps: [],
		...overrides,
	};
}

function makeStep(id: string, traceability?: { requirements?: string[] }) {
	return {
		id,
		title: `Step ${id}`,
		description: `Description for ${id}`,
		actions: [{ tool: "command" as const, command: "echo ok" }],
		traceability,
	};
}

function makeJourneyResult(
	name: string,
	steps: StepResult[],
	traceability?: JourneyDefinition["traceability"],
): JourneyResult {
	const passed = steps.filter((s) => s.status === "pass").length;
	const failed = steps.filter((s) => s.status === "fail").length;
	const skipped = steps.filter((s) => s.status === "skip").length;
	return {
		journeyName: name,
		totalSteps: steps.length,
		passed,
		failed,
		skipped,
		durationMs: 100,
		steps,
		traceability,
	};
}

function makeStepResult(id: string, status: "pass" | "fail" | "skip"): StepResult {
	return {
		stepId: id,
		stepTitle: `Step ${id}`,
		status,
		durationMs: 50,
		actions: [{ tool: "command", success: status === "pass", durationMs: 10 }],
	};
}

function makeReq(id: string, name?: string): RequirementRef {
	return { id, name: name ?? `Requirement ${id}`, status: "active" };
}

// ── extractRequirementIds ────────────────────────────────────────────

describe("extractRequirementIds", () => {
	it("returns empty array when journey has no traceability", () => {
		const journey = makeJourney();
		expect(extractRequirementIds(journey)).toEqual([]);
	});

	it("extracts journey-level requirement IDs", () => {
		const journey = makeJourney({
			traceability: { requirements: ["REQ-001", "REQ-002"] },
		});
		expect(extractRequirementIds(journey)).toEqual(["REQ-001", "REQ-002"]);
	});

	it("extracts step-level requirement IDs", () => {
		const journey = makeJourney({
			steps: [
				makeStep("s1", { requirements: ["REQ-010"] }),
				makeStep("s2", { requirements: ["REQ-011"] }),
			],
		});
		expect(extractRequirementIds(journey)).toEqual(["REQ-010", "REQ-011"]);
	});

	it("merges journey-level and step-level IDs without duplicates", () => {
		const journey = makeJourney({
			traceability: { requirements: ["REQ-001", "REQ-002"] },
			steps: [
				makeStep("s1", { requirements: ["REQ-002", "REQ-003"] }),
			],
		});
		const ids = extractRequirementIds(journey);
		expect(ids).toHaveLength(3);
		expect(ids).toContain("REQ-001");
		expect(ids).toContain("REQ-002");
		expect(ids).toContain("REQ-003");
	});

	it("skips $ref steps", () => {
		const journey = makeJourney({
			traceability: { requirements: ["REQ-001"] },
			steps: [
				{ $ref: "other-journey#step-1" },
				makeStep("s1", { requirements: ["REQ-002"] }),
			],
		});
		const ids = extractRequirementIds(journey);
		expect(ids).toEqual(["REQ-001", "REQ-002"]);
	});

	it("handles steps without traceability", () => {
		const journey = makeJourney({
			steps: [makeStep("s1"), makeStep("s2", { requirements: ["REQ-005"] })],
		});
		expect(extractRequirementIds(journey)).toEqual(["REQ-005"]);
	});
});

// ── extractUseCaseIds ────────────────────────────────────────────────

describe("extractUseCaseIds", () => {
	it("returns empty array when no traceability", () => {
		expect(extractUseCaseIds(makeJourney())).toEqual([]);
	});

	it("returns empty array when traceability has no useCases", () => {
		expect(extractUseCaseIds(makeJourney({ traceability: { requirements: ["R1"] } }))).toEqual([]);
	});

	it("returns use case IDs from journey traceability", () => {
		const journey = makeJourney({
			traceability: { useCases: ["UC-001", "UC-002"] },
		});
		expect(extractUseCaseIds(journey)).toEqual(["UC-001", "UC-002"]);
	});
});

// ── extractUserStoryIds ──────────────────────────────────────────────

describe("extractUserStoryIds", () => {
	it("returns empty array when no traceability", () => {
		expect(extractUserStoryIds(makeJourney())).toEqual([]);
	});

	it("returns empty array when traceability has no userStories", () => {
		expect(extractUserStoryIds(makeJourney({ traceability: {} }))).toEqual([]);
	});

	it("returns user story IDs from journey traceability", () => {
		const journey = makeJourney({
			traceability: { userStories: ["US-100", "US-200"] },
		});
		expect(extractUserStoryIds(journey)).toEqual(["US-100", "US-200"]);
	});
});

// ── validateTraceabilityLinks ────────────────────────────────────────

describe("validateTraceabilityLinks", () => {
	it("returns valid when all links are known", () => {
		const journeys = [
			makeJourney({
				journey: "j1",
				traceability: { requirements: ["REQ-001"], useCases: ["UC-001"] },
			}),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"], ["UC-001"]);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it("reports errors for unknown requirements", () => {
		const journeys = [
			makeJourney({
				journey: "j1",
				traceability: { requirements: ["REQ-MISSING"] },
			}),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"]);
		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("unknown requirement");
		expect(result.errors[0]).toContain("REQ-MISSING");
	});

	it("reports warnings for unknown use cases", () => {
		const journeys = [
			makeJourney({
				journey: "j1",
				traceability: { requirements: ["REQ-001"], useCases: ["UC-UNKNOWN"] },
			}),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"], ["UC-001"]);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("unknown use case");
		expect(result.warnings[0]).toContain("UC-UNKNOWN");
	});

	it("reports warnings for unknown user stories", () => {
		const journeys = [
			makeJourney({
				journey: "j1",
				traceability: { requirements: ["REQ-001"], userStories: ["US-GONE"] },
			}),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"], [], ["US-100"]);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("unknown user story");
	});

	it("warns when journey has no traceability at all", () => {
		const journeys = [makeJourney({ journey: "bare-journey" })];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"]);
		expect(result.valid).toBe(true);
		expect(result.warnings.some((w) => w.includes("no traceability links"))).toBe(true);
	});

	it("does not warn about unknown use cases when no known set is provided", () => {
		const journeys = [
			makeJourney({
				journey: "j1",
				traceability: { requirements: ["REQ-001"], useCases: ["UC-ANY"] },
			}),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"]);
		expect(result.warnings).toHaveLength(0);
	});

	it("validates across multiple journeys", () => {
		const journeys = [
			makeJourney({ journey: "j1", traceability: { requirements: ["REQ-001"] } }),
			makeJourney({ journey: "j2", traceability: { requirements: ["REQ-BAD"] } }),
			makeJourney({ journey: "j3" }),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"]);
		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.warnings.some((w) => w.includes("j3"))).toBe(true);
	});

	it("validates step-level requirement references", () => {
		const journeys = [
			makeJourney({
				journey: "j1",
				steps: [makeStep("s1", { requirements: ["REQ-MISSING"] })],
			}),
		];
		const result = validateTraceabilityLinks(journeys, ["REQ-001"]);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("REQ-MISSING");
	});
});

// ── buildTraceabilityMatrix ──────────────────────────────────────────

describe("buildTraceabilityMatrix", () => {
	it("creates a row for each requirement", () => {
		const reqs = [makeReq("REQ-001"), makeReq("REQ-002")];
		const matrix = buildTraceabilityMatrix([], reqs);
		expect(matrix.rows).toHaveLength(2);
		expect(matrix.totalRequirements).toBe(2);
	});

	it("marks requirements with no linked journey as untested", () => {
		const reqs = [makeReq("REQ-001")];
		const matrix = buildTraceabilityMatrix([], reqs);
		expect(matrix.rows[0].status).toBe("untested");
		expect(matrix.untested).toBe(1);
		expect(matrix.coveragePercent).toBe(0);
	});

	it("marks requirements as verified when linked journey passes", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const result = makeJourneyResult("j1", [makeStepResult("s1", "pass")]);
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")], [result]);
		expect(matrix.rows[0].status).toBe("verified");
		expect(matrix.verified).toBe(1);
		expect(matrix.coveragePercent).toBe(100);
	});

	it("marks requirements as failed when linked journey has failures", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const result = makeJourneyResult("j1", [
			makeStepResult("s1", "pass"),
			makeStepResult("s2", "fail"),
		]);
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")], [result]);
		expect(matrix.rows[0].status).toBe("failed");
		expect(matrix.failed).toBe(1);
	});

	it("marks requirements as partial when journey is linked but no results", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")]);
		expect(matrix.rows[0].status).toBe("partial");
		expect(matrix.partial).toBe(1);
	});

	it("calculates coverage percent from verified and partial", () => {
		const journeys = [
			makeJourney({ journey: "j1", traceability: { requirements: ["REQ-001"] } }),
			makeJourney({ journey: "j2", traceability: { requirements: ["REQ-002"] } }),
		];
		const results = [
			makeJourneyResult("j1", [makeStepResult("s1", "pass")]),
		];
		const reqs = [makeReq("REQ-001"), makeReq("REQ-002"), makeReq("REQ-003")];
		const matrix = buildTraceabilityMatrix(journeys, reqs, results);
		// REQ-001 = verified, REQ-002 = partial, REQ-003 = untested
		expect(matrix.verified).toBe(1);
		expect(matrix.partial).toBe(1);
		expect(matrix.untested).toBe(1);
		expect(matrix.coveragePercent).toBe(67); // Math.round((2/3)*100)
	});

	it("links specific steps that verify a requirement", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
			steps: [
				makeStep("s1", { requirements: ["REQ-001"] }),
				makeStep("s2"),
			],
		});
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")]);
		expect(matrix.rows[0].steps).toContain("j1#s1");
		expect(matrix.rows[0].steps).not.toContain("j1#s2");
	});

	it("captures risk and category from journey traceability", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"], risk: "critical", category: "security" },
		});
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")]);
		expect(matrix.rows[0].risk).toBe("critical");
		expect(matrix.rows[0].category).toBe("security");
	});

	it("handles empty requirements list", () => {
		const matrix = buildTraceabilityMatrix([], []);
		expect(matrix.rows).toHaveLength(0);
		expect(matrix.totalRequirements).toBe(0);
		expect(matrix.coveragePercent).toBe(0);
	});

	it("links multiple journeys to the same requirement", () => {
		const journeys = [
			makeJourney({ journey: "j1", traceability: { requirements: ["REQ-001"] } }),
			makeJourney({ journey: "j2", traceability: { requirements: ["REQ-001"] } }),
		];
		const matrix = buildTraceabilityMatrix(journeys, [makeReq("REQ-001")]);
		expect(matrix.rows[0].journeys).toEqual(["j1", "j2"]);
	});
});

// ── detectGaps ───────────────────────────────────────────────────────

describe("detectGaps", () => {
	it("returns empty array when all requirements are verified", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const result = makeJourneyResult("j1", [makeStepResult("s1", "pass")]);
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")], [result]);
		expect(detectGaps(matrix)).toEqual([]);
	});

	it("detects untested requirements with no journey", () => {
		const matrix = buildTraceabilityMatrix([], [makeReq("REQ-001")]);
		const gaps = detectGaps(matrix);
		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toEqual({ requirementId: "REQ-001", reason: "no-journey" });
	});

	it("detects failed requirements", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const result = makeJourneyResult("j1", [makeStepResult("s1", "fail")]);
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")], [result]);
		const gaps = detectGaps(matrix);
		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toEqual({ requirementId: "REQ-001", reason: "failed" });
	});

	it("detects multiple gaps", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const result = makeJourneyResult("j1", [makeStepResult("s1", "fail")]);
		const reqs = [makeReq("REQ-001"), makeReq("REQ-002")];
		const matrix = buildTraceabilityMatrix([journey], reqs, [result]);
		const gaps = detectGaps(matrix);
		expect(gaps).toHaveLength(2);
		expect(gaps.find((g) => g.requirementId === "REQ-001")?.reason).toBe("failed");
		expect(gaps.find((g) => g.requirementId === "REQ-002")?.reason).toBe("no-journey");
	});

	it("does not report partial requirements as gaps", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"] },
		});
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")]);
		expect(detectGaps(matrix)).toEqual([]);
	});
});

// ── coverageByCategory ───────────────────────────────────────────────

describe("coverageByCategory", () => {
	it("returns empty array when no rows have categories", () => {
		const matrix = buildTraceabilityMatrix([], [makeReq("REQ-001")]);
		expect(coverageByCategory(matrix)).toEqual([]);
	});

	it("groups rows by ISO 25010 category", () => {
		const journeys = [
			makeJourney({ journey: "j1", traceability: { requirements: ["REQ-001"], category: "security" } }),
			makeJourney({ journey: "j2", traceability: { requirements: ["REQ-002"], category: "security" } }),
			makeJourney({ journey: "j3", traceability: { requirements: ["REQ-003"], category: "reliability" } }),
		];
		const results = [
			makeJourneyResult("j1", [makeStepResult("s1", "pass")]),
			makeJourneyResult("j3", [makeStepResult("s1", "pass")]),
		];
		const reqs = [makeReq("REQ-001"), makeReq("REQ-002"), makeReq("REQ-003")];
		const matrix = buildTraceabilityMatrix(journeys, reqs, results);
		const cats = coverageByCategory(matrix);

		const security = cats.find((c) => c.category === "security");
		expect(security).toBeDefined();
		expect(security!.total).toBe(2);
		expect(security!.verified).toBe(1);
		expect(security!.percent).toBe(50);

		const reliability = cats.find((c) => c.category === "reliability");
		expect(reliability).toBeDefined();
		expect(reliability!.total).toBe(1);
		expect(reliability!.verified).toBe(1);
		expect(reliability!.percent).toBe(100);
	});

	it("calculates 0% when no requirements are verified in a category", () => {
		const journey = makeJourney({
			journey: "j1",
			traceability: { requirements: ["REQ-001"], category: "usability" },
		});
		const matrix = buildTraceabilityMatrix([journey], [makeReq("REQ-001")]);
		const cats = coverageByCategory(matrix);
		expect(cats[0].percent).toBe(0);
	});
});
