import { describe, it, expect } from "vitest";
import { estimateDebt, type DebtEstimate } from "../../../src/domain/health/tech-debt.js";
import type { HealthSnapshot } from "../../../src/domain/health/health.js";
import type { HealthScore } from "../../../src/domain/health/health-scoring.js";

const cleanSnapshot: HealthSnapshot = {
	name: "clean",
	source: { files: 50, testFiles: 30 },
	tests: { total: 100, passed: 100, failed: 0, suites: 10 },
	coverage: { lines: 95, branches: 90, functions: 92 },
	build: { success: true, durationMs: 1500 },
	lint: { errors: 0, warnings: 0 },
	git: { branch: "main", status: "clean" },
	security: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
	components: 5,
};

const cleanScore: HealthScore = {
	overall: 100,
	grade: "A",
	categories: { tests: 100, coverage: 100, build: 100, lint: 100, security: 100, git: 100 },
};

describe("estimateDebt", () => {
	it("returns no items for clean project", () => {
		const est = estimateDebt(cleanSnapshot, cleanScore);
		expect(est.items).toHaveLength(0);
		expect(est.totalHours).toBe(0);
		expect(est.summary).toContain("No technical debt");
	});

	it("estimates failing tests", () => {
		const snap = { ...cleanSnapshot, tests: { total: 100, passed: 95, failed: 5, suites: 10 } };
		const est = estimateDebt(snap, cleanScore);
		const item = est.items.find((i) => i.category === "Tests");
		expect(item).toBeDefined();
		expect(item!.estimatedHours).toBe(2.5); // 5 * 0.5h
		expect(item!.description).toContain("5 failing tests");
	});

	it("estimates lint errors", () => {
		const snap = { ...cleanSnapshot, lint: { errors: 10, warnings: 5 } };
		const est = estimateDebt(snap, cleanScore);
		const item = est.items.find((i) => i.category === "Lint" && i.description.includes("error"));
		expect(item).toBeDefined();
		expect(item!.estimatedHours).toBe(2.5); // 10 * 0.25h
	});

	it("estimates lint warnings above threshold", () => {
		const snap = { ...cleanSnapshot, lint: { errors: 0, warnings: 20 } };
		const est = estimateDebt(snap, cleanScore);
		const item = est.items.find((i) => i.description.includes("warning"));
		expect(item).toBeDefined();
		expect(item!.estimatedHours).toBe(1); // (20-10) * 0.1h
	});

	it("does not flag warnings at or below threshold", () => {
		const snap = { ...cleanSnapshot, lint: { errors: 0, warnings: 10 } };
		const est = estimateDebt(snap, cleanScore);
		expect(est.items.find((i) => i.description.includes("warning"))).toBeUndefined();
	});

	it("estimates coverage gaps", () => {
		const snap = { ...cleanSnapshot, coverage: { lines: 60, branches: 50, functions: 70 } };
		const est = estimateDebt(snap, cleanScore);
		const item = est.items.find((i) => i.category === "Coverage");
		expect(item).toBeDefined();
		expect(item!.description).toContain("below 80%");
		expect(item!.estimatedHours).toBeGreaterThan(0);
	});

	it("does not flag coverage at or above 80%", () => {
		const snap = { ...cleanSnapshot, coverage: { lines: 85, branches: 80, functions: 82 } };
		const est = estimateDebt(snap, cleanScore);
		expect(est.items.find((i) => i.category === "Coverage")).toBeUndefined();
	});

	it("estimates build failure", () => {
		const snap = { ...cleanSnapshot, build: { success: false, durationMs: 5000 } };
		const est = estimateDebt(snap, cleanScore);
		const item = est.items.find((i) => i.category === "Build");
		expect(item).toBeDefined();
		expect(item!.estimatedHours).toBe(4);
		expect(item!.severity).toBe("critical");
	});

	it("estimates security vulnerabilities", () => {
		const snap = {
			...cleanSnapshot,
			security: { critical: 1, high: 2, moderate: 3, low: 5, info: 0, total: 11 },
		};
		const est = estimateDebt(snap, cleanScore);
		const secItems = est.items.filter((i) => i.category === "Security");
		expect(secItems).toHaveLength(4);
		expect(secItems[0].severity).toBe("critical");
	});

	it("sorts items by severity then hours", () => {
		const snap = {
			...cleanSnapshot,
			tests: { total: 100, passed: 80, failed: 20, suites: 10 },
			build: { success: false, durationMs: 1000 },
			lint: { errors: 5, warnings: 0 },
		};
		const est = estimateDebt(snap, cleanScore);
		expect(est.items[0].severity).toBe("critical"); // build failure
		expect(est.items.length).toBeGreaterThanOrEqual(3);
	});

	it("computes total hours correctly", () => {
		const snap = {
			...cleanSnapshot,
			tests: { total: 100, passed: 98, failed: 2, suites: 10 },
			lint: { errors: 4, warnings: 0 },
		};
		const est = estimateDebt(snap, cleanScore);
		const expected = 2 * 0.5 + 4 * 0.25; // 1 + 1 = 2
		expect(est.totalHours).toBe(expected);
	});

	it("handles null sections gracefully", () => {
		const snap: HealthSnapshot = {
			name: "minimal",
			source: null,
			tests: null,
			coverage: null,
			build: null,
			lint: null,
			git: null,
			security: null,
			components: 0,
		};
		const est = estimateDebt(snap, cleanScore);
		expect(est.items).toHaveLength(0);
		expect(est.totalHours).toBe(0);
	});
});
