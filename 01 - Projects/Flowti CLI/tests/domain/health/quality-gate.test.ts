import { describe, it, expect } from "vitest";
import {
	evaluateQualityGates,
	resolveMetric,
	DEFAULT_QUALITY_GATES,
	type GateResult,
} from "../../../src/domain/health/quality-gate.js";
import type { HealthSnapshot } from "../../../src/domain/health/health.js";
import type { HealthScore } from "../../../src/domain/health/health-scoring.js";
import type { QualityGateConfig } from "../../../src/infrastructure/types.js";

// ── Fixtures ─────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
	return {
		name: "test-project",
		source: { files: 50, testFiles: 30 },
		tests: { total: 100, passed: 100, failed: 0, suites: 10 },
		coverage: { lines: 85, branches: 80, functions: 90 },
		build: { success: true, durationMs: 5000 },
		lint: { errors: 0, warnings: 2 },
		git: { branch: "main", status: "clean" },
		security: null,
		components: 5,
		...overrides,
	};
}

function makeScore(overrides: Partial<HealthScore> = {}): HealthScore {
	return {
		overall: 85,
		grade: "B",
		categories: {
			tests: 100,
			coverage: 85,
			build: 100,
			lint: 96,
			security: 0,
			git: 100,
		},
		...overrides,
	};
}

// ── resolveMetric ───────────────────────────────────────────────────

describe("resolveMetric", () => {
	const snapshot = makeSnapshot();
	const score = makeScore();

	it("resolves tests.failed", () => {
		expect(resolveMetric(snapshot, score, "tests.failed")).toBe(0);
	});

	it("resolves tests.passed", () => {
		expect(resolveMetric(snapshot, score, "tests.passed")).toBe(100);
	});

	it("resolves coverage.lines", () => {
		expect(resolveMetric(snapshot, score, "coverage.lines")).toBe(85);
	});

	it("resolves build.success as 1 for true", () => {
		expect(resolveMetric(snapshot, score, "build.success")).toBe(1);
	});

	it("resolves build.success as 0 for false", () => {
		const s = makeSnapshot({ build: { success: false, durationMs: 0 } });
		expect(resolveMetric(s, score, "build.success")).toBe(0);
	});

	it("resolves lint.errors", () => {
		expect(resolveMetric(snapshot, score, "lint.errors")).toBe(0);
	});

	it("resolves lint.warnings", () => {
		expect(resolveMetric(snapshot, score, "lint.warnings")).toBe(2);
	});

	it("resolves components (top-level number)", () => {
		expect(resolveMetric(snapshot, score, "components")).toBe(5);
	});

	it("resolves score.overall", () => {
		expect(resolveMetric(snapshot, score, "score.overall")).toBe(85);
	});

	it("resolves score.tests (category)", () => {
		expect(resolveMetric(snapshot, score, "score.tests")).toBe(100);
	});

	it("returns null for missing section", () => {
		const s = makeSnapshot({ tests: null });
		expect(resolveMetric(s, score, "tests.failed")).toBeNull();
	});

	it("returns null for unknown metric", () => {
		expect(resolveMetric(snapshot, score, "unknown.field")).toBeNull();
	});

	it("resolves git.status as null (string, not number)", () => {
		expect(resolveMetric(snapshot, score, "git.status")).toBeNull();
	});
});

// ── evaluateQualityGates ────────────────────────────────────────────

describe("evaluateQualityGates", () => {
	it("passes when config is undefined", () => {
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), undefined);
		expect(result.passed).toBe(true);
		expect(result.rules).toHaveLength(0);
		expect(result.scoreCheck).toBeNull();
	});

	it("passes when enabled is false", () => {
		const config: QualityGateConfig = { enabled: false, rules: [{ metric: "tests.failed", operator: "==", value: 0 }] };
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(true);
		expect(result.rules).toHaveLength(0);
	});

	it("passes when all rules pass", () => {
		const config: QualityGateConfig = {
			enabled: true,
			rules: [
				{ metric: "tests.failed", operator: "==", value: 0 },
				{ metric: "coverage.lines", operator: ">=", value: 80 },
				{ metric: "lint.errors", operator: "==", value: 0 },
			],
		};
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(true);
		expect(result.rules).toHaveLength(3);
		expect(result.rules.every((r) => r.passed)).toBe(true);
	});

	it("fails when a rule fails", () => {
		const config: QualityGateConfig = {
			enabled: true,
			rules: [
				{ metric: "tests.failed", operator: "==", value: 0 },
				{ metric: "coverage.lines", operator: ">=", value: 95 }, // 85 < 95, fails
			],
		};
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(false);
		expect(result.rules[0].passed).toBe(true);
		expect(result.rules[1].passed).toBe(false);
		expect(result.rules[1].actual).toBe(85);
	});

	it("checks minScore and passes", () => {
		const config: QualityGateConfig = { enabled: true, minScore: 70 };
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(true);
		expect(result.scoreCheck).toEqual({ required: 70, actual: 85, passed: true });
	});

	it("checks minScore and fails", () => {
		const config: QualityGateConfig = { enabled: true, minScore: 90 };
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(false);
		expect(result.scoreCheck!.passed).toBe(false);
	});

	it("fails when metric is unavailable (null)", () => {
		const config: QualityGateConfig = {
			enabled: true,
			rules: [{ metric: "tests.failed", operator: "==", value: 0 }],
		};
		const snapshot = makeSnapshot({ tests: null });
		const result = evaluateQualityGates(snapshot, makeScore(), config);
		expect(result.passed).toBe(false);
		expect(result.rules[0].actual).toBeNull();
		expect(result.rules[0].passed).toBe(false);
	});

	it("supports <= operator", () => {
		const config: QualityGateConfig = {
			enabled: true,
			rules: [{ metric: "lint.warnings", operator: "<=", value: 5 }],
		};
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(true);
		expect(result.rules[0].actual).toBe(2);
	});

	it("supports combined minScore + rules", () => {
		const config: QualityGateConfig = {
			enabled: true,
			minScore: 80,
			rules: [
				{ metric: "tests.failed", operator: "==", value: 0 },
				{ metric: "build.success", operator: "==", value: 1 },
			],
		};
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), config);
		expect(result.passed).toBe(true);
		expect(result.scoreCheck!.passed).toBe(true);
		expect(result.rules).toHaveLength(2);
	});

	it("fails test count with failing tests", () => {
		const config: QualityGateConfig = {
			enabled: true,
			rules: [{ metric: "tests.failed", operator: "==", value: 0 }],
		};
		const snapshot = makeSnapshot({ tests: { total: 100, passed: 95, failed: 5, suites: 10 } });
		const result = evaluateQualityGates(snapshot, makeScore(), config);
		expect(result.passed).toBe(false);
		expect(result.rules[0].actual).toBe(5);
	});
});

// ── DEFAULT_QUALITY_GATES ────────────────────────────────────────────

describe("DEFAULT_QUALITY_GATES", () => {
	it("has sensible defaults", () => {
		expect(DEFAULT_QUALITY_GATES.enabled).toBe(true);
		expect(DEFAULT_QUALITY_GATES.minScore).toBe(60);
		expect(DEFAULT_QUALITY_GATES.rules).toHaveLength(2);
	});

	it("passes for a healthy project", () => {
		const result = evaluateQualityGates(makeSnapshot(), makeScore(), DEFAULT_QUALITY_GATES);
		expect(result.passed).toBe(true);
	});

	it("fails for a project with failing tests", () => {
		const snapshot = makeSnapshot({ tests: { total: 100, passed: 95, failed: 5, suites: 10 } });
		const result = evaluateQualityGates(snapshot, makeScore(), DEFAULT_QUALITY_GATES);
		expect(result.passed).toBe(false);
	});

	it("fails for a project with lint errors", () => {
		const snapshot = makeSnapshot({ lint: { errors: 3, warnings: 0 } });
		const result = evaluateQualityGates(snapshot, makeScore(), DEFAULT_QUALITY_GATES);
		expect(result.passed).toBe(false);
	});
});
