import { describe, it, expect } from "vitest";
import {
	evaluateCoverageGate,
	evaluateSecurityGate,
	evaluateRiskGate,
	evaluateGates,
	type QualityGateConfig,
} from "../../../src/domain/review/quality-gates.js";
import type { TraceabilityMatrix } from "../../../src/domain/review/traceability.js";
import type { JourneyResult, StepResult } from "../../../src/domain/e2e/journey/journey-types.js";

// ── Fixtures ─────────────────────────────────────────────────────────

function makeStepResult(id: string, status: "pass" | "fail" | "skip"): StepResult {
	return {
		stepId: id,
		stepTitle: `Step ${id}`,
		status,
		durationMs: 50,
		actions: [{ tool: "command", success: status === "pass", durationMs: 10 }],
	};
}

function makeJourneyResult(
	name: string,
	steps: StepResult[],
	traceability?: JourneyResult["traceability"],
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

function makeMatrix(overrides: Partial<TraceabilityMatrix> = {}): TraceabilityMatrix {
	return {
		rows: [],
		totalRequirements: 0,
		verified: 0,
		failed: 0,
		untested: 0,
		partial: 0,
		coveragePercent: 0,
		...overrides,
	};
}

// ── evaluateCoverageGate ─────────────────────────────────────────────

describe("evaluateCoverageGate", () => {
	it("passes when requirement coverage meets threshold", () => {
		const matrix = makeMatrix({ coveragePercent: 90 });
		const result = evaluateCoverageGate({ requirementCoverage: 80 }, matrix);
		expect(result.passed).toBe(true);
		expect(result.gate).toBe("coverage");
		expect(result.metrics?.requirementCoverage).toBe(90);
	});

	it("fails when requirement coverage is below threshold", () => {
		const matrix = makeMatrix({ coveragePercent: 50 });
		const result = evaluateCoverageGate({ requirementCoverage: 80 }, matrix);
		expect(result.passed).toBe(false);
		expect(result.details).toContain("50%");
		expect(result.details).toContain("80%");
	});

	it("passes when coverage exactly equals threshold", () => {
		const matrix = makeMatrix({ coveragePercent: 80 });
		const result = evaluateCoverageGate({ requirementCoverage: 80 }, matrix);
		expect(result.passed).toBe(true);
	});

	it("passes when statement coverage meets threshold", () => {
		const result = evaluateCoverageGate({ statementCoverage: 70 }, undefined, 85);
		expect(result.passed).toBe(true);
		expect(result.metrics?.statementCoverage).toBe(85);
	});

	it("fails when statement coverage is below threshold", () => {
		const result = evaluateCoverageGate({ statementCoverage: 90 }, undefined, 60);
		expect(result.passed).toBe(false);
		expect(result.details).toContain("60%");
	});

	it("checks both requirement and statement coverage", () => {
		const matrix = makeMatrix({ coveragePercent: 95 });
		const result = evaluateCoverageGate(
			{ requirementCoverage: 80, statementCoverage: 70 },
			matrix,
			85,
		);
		expect(result.passed).toBe(true);
	});

	it("fails if any sub-metric fails", () => {
		const matrix = makeMatrix({ coveragePercent: 95 });
		const result = evaluateCoverageGate(
			{ requirementCoverage: 80, statementCoverage: 90 },
			matrix,
			50,
		);
		expect(result.passed).toBe(false);
	});

	it("skips requirement coverage check when no matrix provided", () => {
		const result = evaluateCoverageGate({ requirementCoverage: 80 });
		expect(result.passed).toBe(true);
	});

	it("includes journey coverage note when configured", () => {
		const result = evaluateCoverageGate({ journeyCoverage: 80 });
		expect(result.details).toContain("Journey coverage");
	});
});

// ── evaluateSecurityGate ─────────────────────────────────────────────

describe("evaluateSecurityGate", () => {
	it("passes when security gate is not required", () => {
		const result = evaluateSecurityGate({ required: false }, []);
		expect(result.passed).toBe(true);
		expect(result.details).toContain("not required");
	});

	it("passes when no security journeys have failures", () => {
		const results = [
			makeJourneyResult("sec-login", [makeStepResult("s1", "pass")], {
				category: "security",
				risk: "critical",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxCritical: 0 }, results);
		expect(result.passed).toBe(true);
	});

	it("fails when critical findings exceed maxCritical", () => {
		const results = [
			makeJourneyResult("sec-auth", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "critical",
			}),
			makeJourneyResult("sec-xss", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "critical",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxCritical: 0 }, results);
		expect(result.passed).toBe(false);
		expect(result.details).toContain("2 critical findings");
	});

	it("fails when high findings exceed maxHigh", () => {
		const results = [
			makeJourneyResult("sec-csrf", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "high",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxHigh: 0 }, results);
		expect(result.passed).toBe(false);
		expect(result.details).toContain("1 high findings");
	});

	it("passes when findings are within limits", () => {
		const results = [
			makeJourneyResult("sec-csrf", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "high",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxCritical: 0, maxHigh: 1 }, results);
		expect(result.passed).toBe(true);
	});

	it("ignores non-security journeys", () => {
		const results = [
			makeJourneyResult("func-login", [makeStepResult("s1", "fail")], {
				category: "functional-suitability",
				risk: "critical",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxCritical: 0 }, results);
		expect(result.passed).toBe(true);
	});

	it("returns metrics with finding counts", () => {
		const results = [
			makeJourneyResult("sec-a", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "critical",
			}),
			makeJourneyResult("sec-b", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "high",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxCritical: 5, maxHigh: 5 }, results);
		expect(result.metrics).toEqual({ critical: 1, high: 1, medium: 0, low: 0 });
	});

	it("defaults to medium risk when journey has no risk level", () => {
		const results = [
			makeJourneyResult("sec-no-risk", [makeStepResult("s1", "fail")], {
				category: "security",
			}),
		];
		const result = evaluateSecurityGate({ required: true, maxCritical: 0, maxHigh: 0 }, results);
		expect(result.passed).toBe(true); // medium is not checked by maxCritical/maxHigh
		expect(result.metrics?.medium).toBe(1);
	});
});

// ── evaluateRiskGate ─────────────────────────────────────────────────

describe("evaluateRiskGate", () => {
	it("passes when all critical journeys pass", () => {
		const results = [
			makeJourneyResult("crit-1", [makeStepResult("s1", "pass")], { risk: "critical" }),
		];
		const result = evaluateRiskGate({ criticalMustPass: true }, results);
		expect(result.passed).toBe(true);
		expect(result.details).toContain("All 1 critical journeys passed");
	});

	it("fails when a critical journey fails", () => {
		const results = [
			makeJourneyResult("crit-1", [makeStepResult("s1", "fail")], { risk: "critical" }),
			makeJourneyResult("crit-2", [makeStepResult("s1", "pass")], { risk: "critical" }),
		];
		const result = evaluateRiskGate({ criticalMustPass: true }, results);
		expect(result.passed).toBe(false);
		expect(result.details).toContain("1 critical journey(s) failed");
		expect(result.details).toContain("crit-1");
	});

	it("passes when all high-risk journeys pass", () => {
		const results = [
			makeJourneyResult("high-1", [makeStepResult("s1", "pass")], { risk: "high" }),
		];
		const result = evaluateRiskGate({ highMustPass: true }, results);
		expect(result.passed).toBe(true);
	});

	it("fails when a high-risk journey fails", () => {
		const results = [
			makeJourneyResult("high-1", [makeStepResult("s1", "fail")], { risk: "high" }),
		];
		const result = evaluateRiskGate({ highMustPass: true }, results);
		expect(result.passed).toBe(false);
		expect(result.details).toContain("high-risk journey(s) failed");
	});

	it("checks both critical and high when both are configured", () => {
		const results = [
			makeJourneyResult("crit-1", [makeStepResult("s1", "pass")], { risk: "critical" }),
			makeJourneyResult("high-1", [makeStepResult("s1", "fail")], { risk: "high" }),
		];
		const result = evaluateRiskGate({ criticalMustPass: true, highMustPass: true }, results);
		expect(result.passed).toBe(false);
	});

	it("passes when no risk config is set", () => {
		const results = [
			makeJourneyResult("j1", [makeStepResult("s1", "fail")], { risk: "critical" }),
		];
		const result = evaluateRiskGate({}, results);
		expect(result.passed).toBe(true);
	});

	it("defaults journeys with no risk to low", () => {
		const results = [
			makeJourneyResult("no-risk", [makeStepResult("s1", "fail")]),
		];
		const result = evaluateRiskGate({ criticalMustPass: true, highMustPass: true }, results);
		expect(result.passed).toBe(true); // low-risk failures don't trigger gates
	});
});

// ── evaluateGates ────────────────────────────────────────────────────

describe("evaluateGates", () => {
	it("evaluates all configured gates", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 80 },
			security: { required: true, maxCritical: 0 },
			risk: { criticalMustPass: true },
		};
		const matrix = makeMatrix({ coveragePercent: 90 });
		const results = [
			makeJourneyResult("j1", [makeStepResult("s1", "pass")], { risk: "critical" }),
		];

		const evaluation = evaluateGates(config, results, matrix);
		expect(evaluation.gates).toHaveLength(3);
		expect(evaluation.allPassed).toBe(true);
	});

	it("reports allPassed false when any gate fails", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 95 },
		};
		const matrix = makeMatrix({ coveragePercent: 50 });

		const evaluation = evaluateGates(config, [], matrix);
		expect(evaluation.allPassed).toBe(false);
	});

	it("sets releaseEligible based on allGatesMustPass", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 95 },
			release: { allGatesMustPass: true },
		};
		const matrix = makeMatrix({ coveragePercent: 50 });

		const evaluation = evaluateGates(config, [], matrix);
		expect(evaluation.releaseEligible).toBe(false);
	});

	it("release is eligible when allGatesMustPass is not set despite failures", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 95 },
		};
		const matrix = makeMatrix({ coveragePercent: 50 });

		const evaluation = evaluateGates(config, [], matrix);
		expect(evaluation.releaseEligible).toBe(true);
	});

	it("blocks release when requireApproval is set even if all gates pass", () => {
		const config: QualityGateConfig = {
			release: { requireApproval: true },
		};

		const evaluation = evaluateGates(config, []);
		expect(evaluation.allPassed).toBe(true);
		expect(evaluation.releaseEligible).toBe(false);
	});

	it("skips unconfigured gates", () => {
		const config: QualityGateConfig = {};
		const evaluation = evaluateGates(config, []);
		expect(evaluation.gates).toHaveLength(0);
		expect(evaluation.allPassed).toBe(true);
	});

	it("returns empty CAPA list when all gates pass", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 50 },
		};
		const matrix = makeMatrix({ coveragePercent: 80 });
		const evaluation = evaluateGates(config, [], matrix);
		expect(evaluation.capaItems).toHaveLength(0);
	});
});

// ── Auto-CAPA generation ─────────────────────────────────────────────

describe("Auto-CAPA generation", () => {
	it("generates CAPA for coverage gate failure", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 90 },
			release: { allGatesMustPass: true },
		};
		const matrix = makeMatrix({ coveragePercent: 40 });
		const evaluation = evaluateGates(config, [], matrix);

		expect(evaluation.capaItems).toHaveLength(1);
		expect(evaluation.capaItems[0].gate).toBe("coverage");
		expect(evaluation.capaItems[0].severity).toBe("medium");
		expect(evaluation.capaItems[0].source).toBe("e2e-gate-failure");
		expect(evaluation.capaItems[0].name).toContain("Coverage gate failure");
	});

	it("generates CAPA for each failed security journey", () => {
		const config: QualityGateConfig = {
			security: { required: true, maxCritical: 0 },
		};
		const results = [
			makeJourneyResult("sec-auth", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "critical",
			}),
			makeJourneyResult("sec-xss", [makeStepResult("s1", "fail")], {
				category: "security",
				risk: "high",
			}),
		];

		const evaluation = evaluateGates(config, results);
		const secCapas = evaluation.capaItems.filter((c) => c.gate === "security");
		expect(secCapas).toHaveLength(2);

		const authCapa = secCapas.find((c) => c.linkedJourney === "sec-auth");
		expect(authCapa).toBeDefined();
		expect(authCapa!.severity).toBe("critical");
		expect(authCapa!.description).toContain("sec-auth");

		const xssCapa = secCapas.find((c) => c.linkedJourney === "sec-xss");
		expect(xssCapa).toBeDefined();
		expect(xssCapa!.severity).toBe("high");
	});

	it("generates CAPA for failed critical/high risk journeys", () => {
		const config: QualityGateConfig = {
			risk: { criticalMustPass: true },
		};
		const results = [
			makeJourneyResult("crit-deploy", [makeStepResult("s1", "fail")], { risk: "critical" }),
			makeJourneyResult("low-docs", [makeStepResult("s1", "fail")], { risk: "low" }),
		];

		const evaluation = evaluateGates(config, results);
		const riskCapas = evaluation.capaItems.filter((c) => c.gate === "risk");
		expect(riskCapas).toHaveLength(1);
		expect(riskCapas[0].linkedJourney).toBe("crit-deploy");
		expect(riskCapas[0].severity).toBe("critical");
	});

	it("does not generate CAPAs for passing gates", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 50 },
			security: { required: true, maxCritical: 5 },
			risk: { criticalMustPass: true },
		};
		const matrix = makeMatrix({ coveragePercent: 100 });
		const results = [
			makeJourneyResult("j1", [makeStepResult("s1", "pass")], { risk: "critical" }),
		];
		const evaluation = evaluateGates(config, results, matrix);
		expect(evaluation.capaItems).toHaveLength(0);
	});

	it("generates CAPAs from multiple failing gates in one evaluation", () => {
		const config: QualityGateConfig = {
			coverage: { requirementCoverage: 99 },
			risk: { criticalMustPass: true },
			release: { allGatesMustPass: true },
		};
		const matrix = makeMatrix({ coveragePercent: 10 });
		const results = [
			makeJourneyResult("crit-1", [makeStepResult("s1", "fail")], { risk: "critical" }),
		];

		const evaluation = evaluateGates(config, results, matrix);
		expect(evaluation.capaItems.length).toBeGreaterThanOrEqual(2);

		const coverageCapa = evaluation.capaItems.find((c) => c.gate === "coverage");
		const riskCapa = evaluation.capaItems.find((c) => c.gate === "risk");
		expect(coverageCapa).toBeDefined();
		expect(riskCapa).toBeDefined();
	});
});
