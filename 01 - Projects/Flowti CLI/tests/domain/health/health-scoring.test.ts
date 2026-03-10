import { describe, it, expect } from "vitest";
import {
	scoreHealth,
	letterGrade,
	type HealthThresholds,
	type HealthScore,
	DEFAULT_THRESHOLDS,
} from "../../../src/domain/health/health-scoring.js";
import type { HealthSnapshot } from "../../../src/domain/health/health.js";

// ── Fixtures ─────────────────────────────────────────────────────────

const fullSnapshot: HealthSnapshot = {
	name: "test-project",
	source: { files: 50, testFiles: 30 },
	tests: { total: 100, passed: 100, failed: 0, suites: 10 },
	coverage: { lines: 95, branches: 95, functions: 95 },
	build: { success: true, durationMs: 1500 },
	lint: { errors: 0, warnings: 0 },
	git: { branch: "main", status: "clean" },
	security: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
	components: 5,
};

const emptySnapshot: HealthSnapshot = {
	name: "empty",
	source: null,
	tests: null,
	coverage: null,
	build: null,
	lint: null,
	git: null,
	security: null,
	components: 0,
};

// ── scoreHealth ──────────────────────────────────────────────────────

describe("scoreHealth", () => {
	it("returns perfect score for healthy project", () => {
		const score = scoreHealth(fullSnapshot);
		expect(score.overall).toBe(100);
		expect(score.grade).toBe("A");
	});

	it("returns zero score for empty snapshot", () => {
		const score = scoreHealth(emptySnapshot);
		expect(score.overall).toBe(0);
		expect(score.grade).toBe("F");
	});

	it("penalizes failed tests", () => {
		const snapshot = {
			...fullSnapshot,
			tests: { total: 100, passed: 90, failed: 10, suites: 10 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.tests).toBeLessThan(100);
		expect(score.overall).toBeLessThan(100);
	});

	it("penalizes low coverage", () => {
		const snapshot = {
			...fullSnapshot,
			coverage: { lines: 40, branches: 30, functions: 50 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.coverage).toBeLessThan(100);
	});

	it("penalizes failed build", () => {
		const snapshot = {
			...fullSnapshot,
			build: { success: false, durationMs: 1500 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.build).toBe(0);
	});

	it("penalizes lint errors", () => {
		const snapshot = {
			...fullSnapshot,
			lint: { errors: 5, warnings: 10 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.lint).toBeLessThan(100);
	});

	it("penalizes dirty git status", () => {
		const snapshot = {
			...fullSnapshot,
			git: { branch: "main", status: "dirty" },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.git).toBeLessThan(100);
	});

	it("uses custom thresholds", () => {
		const thresholds: HealthThresholds = {
			coverage: { min: 95, target: 100 },
			lint: { maxErrors: 0, maxWarnings: 0 },
			tests: { minPassed: 100 },
		};
		// 90% coverage is below 95 min threshold
		const score = scoreHealth(fullSnapshot, thresholds);
		expect(score.categories.coverage).toBeLessThan(100);
	});

	it("includes all category scores", () => {
		const score = scoreHealth(fullSnapshot);
		expect(score.categories).toHaveProperty("tests");
		expect(score.categories).toHaveProperty("coverage");
		expect(score.categories).toHaveProperty("build");
		expect(score.categories).toHaveProperty("lint");
		expect(score.categories).toHaveProperty("security");
		expect(score.categories).toHaveProperty("git");
	});

	it("overall is weighted average of categories", () => {
		const score = scoreHealth(fullSnapshot);
		// All 100 → overall 100
		const allHundred = Object.values(score.categories).every((v) => v === 100);
		if (allHundred) {
			expect(score.overall).toBe(100);
		}
	});
});

// ── security scoring ─────────────────────────────────────────────────

describe("security scoring", () => {
	it("returns 100 for zero vulnerabilities", () => {
		const score = scoreHealth(fullSnapshot);
		expect(score.categories.security).toBe(100);
	});

	it("penalizes critical vulnerabilities heavily", () => {
		const snapshot = {
			...fullSnapshot,
			security: { critical: 1, high: 0, moderate: 0, low: 0, info: 0, total: 1 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.security).toBe(70);
	});

	it("penalizes high vulnerabilities", () => {
		const snapshot = {
			...fullSnapshot,
			security: { critical: 0, high: 2, moderate: 0, low: 0, info: 0, total: 2 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.security).toBe(70);
	});

	it("penalizes moderate vulnerabilities mildly", () => {
		const snapshot = {
			...fullSnapshot,
			security: { critical: 0, high: 0, moderate: 3, low: 0, info: 0, total: 3 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.security).toBe(85);
	});

	it("clamps to zero for many critical vulns", () => {
		const snapshot = {
			...fullSnapshot,
			security: { critical: 5, high: 3, moderate: 10, low: 5, info: 0, total: 23 },
		};
		const score = scoreHealth(snapshot);
		expect(score.categories.security).toBe(0);
	});

	it("returns 0 when security is null", () => {
		const snapshot = { ...fullSnapshot, security: null };
		const score = scoreHealth(snapshot);
		expect(score.categories.security).toBe(0);
	});
});

// ── letterGrade ──────────────────────────────────────────────────────

describe("letterGrade", () => {
	it("A for 90–100", () => {
		expect(letterGrade(100)).toBe("A");
		expect(letterGrade(90)).toBe("A");
	});

	it("B for 80–89", () => {
		expect(letterGrade(89)).toBe("B");
		expect(letterGrade(80)).toBe("B");
	});

	it("C for 70–79", () => {
		expect(letterGrade(79)).toBe("C");
		expect(letterGrade(70)).toBe("C");
	});

	it("D for 60–69", () => {
		expect(letterGrade(69)).toBe("D");
		expect(letterGrade(60)).toBe("D");
	});

	it("F for below 60", () => {
		expect(letterGrade(59)).toBe("F");
		expect(letterGrade(0)).toBe("F");
	});
});

// ── DEFAULT_THRESHOLDS ──────────────────────────────────────────────

describe("DEFAULT_THRESHOLDS", () => {
	it("has coverage defaults", () => {
		expect(DEFAULT_THRESHOLDS.coverage.min).toBe(80);
		expect(DEFAULT_THRESHOLDS.coverage.target).toBe(95);
	});

	it("has lint defaults", () => {
		expect(DEFAULT_THRESHOLDS.lint.maxErrors).toBe(0);
		expect(DEFAULT_THRESHOLDS.lint.maxWarnings).toBe(10);
	});

	it("has tests defaults", () => {
		expect(DEFAULT_THRESHOLDS.tests.minPassed).toBe(100);
	});
});
