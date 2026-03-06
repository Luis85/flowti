import { describe, it, expect } from "vitest";
import {
	checkProblemGate,
	checkDesignGate,
	checkReadinessGate,
	checkBuildGate,
	checkQualityGate,
	runGateCheck,
	createDefaultGateContext,
	type GateContext,
} from "../../../src/domain/featureLifecycle/gateChecks";
import type { FeatureEntry } from "../../../src/domain/featureLifecycle/types";

// ── Helpers ─────────────────────────────────────────────────

function createEntry(overrides: Partial<FeatureEntry> = {}): FeatureEntry {
	return {
		name: "Test Feature",
		filePath: "docs/features/Test Feature/Test Feature PRD.md",
		stage: "idea",
		rawStage: "idea",
		domain: "Flowti",
		fri: null,
		prioritization: null,
		pbis: [],
		relatedEvents: [],
		maturity: null,
		...overrides,
	};
}

function createPassingProblemCtx(overrides: Partial<GateContext> = {}): GateContext {
	return {
		...createDefaultGateContext(),
		prdExists: true,
		hasProblemStatement: true,
		hasOutcome: true,
		...overrides,
	};
}

function createPassingDesignCtx(overrides: Partial<GateContext> = {}): GateContext {
	return {
		...createPassingProblemCtx(),
		hasScope: true,
		functionalRequirementCount: 5,
		hasEventImpact: true,
		...overrides,
	};
}

function createPassingReadinessCtx(overrides: Partial<GateContext> = {}): GateContext {
	return {
		...createPassingDesignCtx(),
		acceptanceCriteriaCount: 5,
		hasDataModel: true,
		hasTechnicalReview: true,
		...overrides,
	};
}

function createPassingBuildCtx(overrides: Partial<GateContext> = {}): GateContext {
	return {
		...createPassingReadinessCtx(),
		pbisDone: 3,
		buildPasses: true,
		testsExist: true,
		...overrides,
	};
}

function createPassingQualityCtx(overrides: Partial<GateContext> = {}): GateContext {
	return {
		...createPassingBuildCtx(),
		acceptanceCriteriaChecked: 5,
		docsUpdated: true,
		tasmScore: 20,
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("gateChecks", () => {
	describe("createDefaultGateContext", () => {
		it("returns all-false / zero / null defaults", () => {
			const ctx = createDefaultGateContext();
			expect(ctx.prdExists).toBe(false);
			expect(ctx.hasProblemStatement).toBe(false);
			expect(ctx.hasOutcome).toBe(false);
			expect(ctx.hasScope).toBe(false);
			expect(ctx.functionalRequirementCount).toBe(0);
			expect(ctx.hasEventImpact).toBe(false);
			expect(ctx.acceptanceCriteriaCount).toBe(0);
			expect(ctx.acceptanceCriteriaChecked).toBe(0);
			expect(ctx.hasDataModel).toBe(false);
			expect(ctx.hasTechnicalReview).toBe(false);
			expect(ctx.pbisDone).toBe(0);
			expect(ctx.buildPasses).toBe(false);
			expect(ctx.testsExist).toBe(false);
			expect(ctx.docsUpdated).toBe(false);
			expect(ctx.tasmScore).toBeNull();
		});
	});

	// ── Problem Gate (idea → draft) ─────────────────────────

	describe("checkProblemGate", () => {
		it("passes when all criteria met", () => {
			const result = checkProblemGate(createEntry(), createPassingProblemCtx());
			expect(result.gate).toBe("problem");
			expect(result.passed).toBe(true);
			expect(result.checks).toHaveLength(4);
			expect(result.checks.every((c) => c.passed)).toBe(true);
		});

		it("fails when PRD missing", () => {
			const result = checkProblemGate(createEntry(), createPassingProblemCtx({ prdExists: false }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "problem.prd_exists");
			expect(check?.passed).toBe(false);
			expect(check?.reason).toContain("No PRD");
		});

		it("fails when problem statement missing", () => {
			const result = checkProblemGate(createEntry(), createPassingProblemCtx({ hasProblemStatement: false }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "problem.has_problem_statement");
			expect(check?.passed).toBe(false);
		});

		it("fails when outcome missing", () => {
			const result = checkProblemGate(createEntry(), createPassingProblemCtx({ hasOutcome: false }));
			expect(result.passed).toBe(false);
		});

		it("passes with warning when domain is unknown", () => {
			const result = checkProblemGate(
				createEntry({ domain: "unknown" }),
				createPassingProblemCtx(),
			);
			expect(result.passed).toBe(true); // warning-only
			const check = result.checks.find((c) => c.id === "problem.has_domain");
			expect(check?.passed).toBe(false);
			expect(check?.severity).toBe("warning");
		});

		it("fails on default context", () => {
			const result = checkProblemGate(createEntry(), createDefaultGateContext());
			expect(result.passed).toBe(false);
		});
	});

	// ── Design Gate (draft → approved) ──────────────────────

	describe("checkDesignGate", () => {
		it("passes when all criteria met with FRI ≥ 11", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
			});
			const result = checkDesignGate(entry, createPassingDesignCtx());
			expect(result.gate).toBe("design");
			expect(result.passed).toBe(true);
		});

		it("fails when scope missing", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
			});
			const result = checkDesignGate(entry, createPassingDesignCtx({ hasScope: false }));
			expect(result.passed).toBe(false);
		});

		it("fails when fewer than 3 FRs", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
			});
			const result = checkDesignGate(entry, createPassingDesignCtx({ functionalRequirementCount: 2 }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "design.has_frs");
			expect(check?.reason).toContain("2");
		});

		it("passes with warning when event impact missing", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
			});
			const result = checkDesignGate(entry, createPassingDesignCtx({ hasEventImpact: false }));
			expect(result.passed).toBe(true); // warning-only
			const check = result.checks.find((c) => c.id === "design.has_event_impact");
			expect(check?.severity).toBe("warning");
		});

		it("fails when FRI below 11", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 8, level: "not-ready", levelLabel: "Not Ready" },
			});
			const result = checkDesignGate(entry, createPassingDesignCtx());
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "design.fri_threshold");
			expect(check?.reason).toContain("8");
		});

		it("fails when FRI is null (total defaults to 0)", () => {
			const result = checkDesignGate(createEntry(), createPassingDesignCtx());
			expect(result.passed).toBe(false);
		});
	});

	// ── Readiness Gate (approved → in-progress) ─────────────

	describe("checkReadinessGate", () => {
		it("passes when all criteria met with FRI ≥ 19", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 22, level: "technically-ready", levelLabel: "Technically Ready" },
			});
			const result = checkReadinessGate(entry, createPassingReadinessCtx());
			expect(result.gate).toBe("readiness");
			expect(result.passed).toBe(true);
		});

		it("fails when fewer than 3 ACs", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 22, level: "technically-ready", levelLabel: "Technically Ready" },
			});
			const result = checkReadinessGate(entry, createPassingReadinessCtx({ acceptanceCriteriaCount: 1 }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "readiness.has_acs");
			expect(check?.reason).toContain("1");
		});

		it("passes with warning when data model missing", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 22, level: "technically-ready", levelLabel: "Technically Ready" },
			});
			const result = checkReadinessGate(entry, createPassingReadinessCtx({ hasDataModel: false }));
			expect(result.passed).toBe(true); // warning-only
		});

		it("fails when technical review missing", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 22, level: "technically-ready", levelLabel: "Technically Ready" },
			});
			const result = checkReadinessGate(entry, createPassingReadinessCtx({ hasTechnicalReview: false }));
			expect(result.passed).toBe(false);
		});

		it("fails when FRI below 19", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
			});
			const result = checkReadinessGate(entry, createPassingReadinessCtx());
			expect(result.passed).toBe(false);
		});
	});

	// ── Build Gate (in-progress → review) ───────────────────

	describe("checkBuildGate", () => {
		it("passes when all criteria met", () => {
			const result = checkBuildGate(createEntry(), createPassingBuildCtx());
			expect(result.gate).toBe("build");
			expect(result.passed).toBe(true);
		});

		it("fails when no PBIs done", () => {
			const result = checkBuildGate(createEntry(), createPassingBuildCtx({ pbisDone: 0 }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "build.pbi_done");
			expect(check?.passed).toBe(false);
		});

		it("passes with warning when build not confirmed", () => {
			const result = checkBuildGate(createEntry(), createPassingBuildCtx({ buildPasses: false }));
			expect(result.passed).toBe(true); // warning-only
			const check = result.checks.find((c) => c.id === "build.build_passes");
			expect(check?.severity).toBe("warning");
		});

		it("passes with warning when tests missing", () => {
			const result = checkBuildGate(createEntry(), createPassingBuildCtx({ testsExist: false }));
			expect(result.passed).toBe(true); // warning-only
			const check = result.checks.find((c) => c.id === "build.tests_exist");
			expect(check?.severity).toBe("warning");
		});
	});

	// ── Quality Gate (review → done) ────────────────────────

	describe("checkQualityGate", () => {
		it("passes when all criteria met", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx());
			expect(result.gate).toBe("quality");
			expect(result.passed).toBe(true);
		});

		it("fails when not all ACs checked", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx({ acceptanceCriteriaChecked: 3 }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "quality.all_ac_met");
			expect(check?.reason).toContain("3/5");
		});

		it("fails when no ACs exist", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx({
				acceptanceCriteriaCount: 0,
				acceptanceCriteriaChecked: 0,
			}));
			expect(result.passed).toBe(false);
		});

		it("passes with warning when docs not updated", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx({ docsUpdated: false }));
			expect(result.passed).toBe(true); // warning-only
		});

		it("fails when TASM below 19", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx({ tasmScore: 15 }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "quality.tasm_threshold");
			expect(check?.reason).toContain("15");
		});

		it("fails when TASM is null", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx({ tasmScore: null }));
			expect(result.passed).toBe(false);
			const check = result.checks.find((c) => c.id === "quality.tasm_threshold");
			expect(check?.reason).toContain("No TASM");
		});

		it("passes with TASM exactly 19", () => {
			const result = checkQualityGate(createEntry(), createPassingQualityCtx({ tasmScore: 19 }));
			expect(result.passed).toBe(true);
		});
	});

	// ── runGateCheck ────────────────────────────────────────

	describe("runGateCheck", () => {
		it("returns null for idea stage (no gate)", () => {
			const result = runGateCheck(createEntry(), "idea", createDefaultGateContext());
			expect(result).toBeNull();
		});

		it("runs problem gate for draft stage", () => {
			const result = runGateCheck(createEntry(), "draft", createPassingProblemCtx());
			expect(result).not.toBeNull();
			expect(result!.gate).toBe("problem");
			expect(result!.passed).toBe(true);
		});

		it("runs design gate for approved stage", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
			});
			const result = runGateCheck(entry, "approved", createPassingDesignCtx());
			expect(result!.gate).toBe("design");
			expect(result!.passed).toBe(true);
		});

		it("runs readiness gate for in-progress stage", () => {
			const entry = createEntry({
				fri: { dimensions: {} as any, total: 22, level: "technically-ready", levelLabel: "Technically Ready" },
			});
			const result = runGateCheck(entry, "in-progress", createPassingReadinessCtx());
			expect(result!.gate).toBe("readiness");
			expect(result!.passed).toBe(true);
		});

		it("runs build gate for review stage", () => {
			const result = runGateCheck(createEntry(), "review", createPassingBuildCtx());
			expect(result!.gate).toBe("build");
			expect(result!.passed).toBe(true);
		});

		it("runs quality gate for done stage", () => {
			const result = runGateCheck(createEntry(), "done", createPassingQualityCtx());
			expect(result!.gate).toBe("quality");
			expect(result!.passed).toBe(true);
		});
	});
});
