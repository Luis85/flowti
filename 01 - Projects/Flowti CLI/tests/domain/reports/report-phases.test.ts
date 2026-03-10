import { describe, it, expect } from "vitest";
import {
	partitionByDependency,
	collectPrerequisites,
} from "../../../src/domain/reports/report-phases.js";
import type { ReportGenerator } from "../../../src/infrastructure/types.js";

// ── partitionByDependency ───────────────────────────────────────────

describe("partitionByDependency", () => {
	it("puts all independent generators in phase 0", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test" },
			{ id: "coverage", label: "Coverage" },
			{ id: "codebase", label: "Codebase" },
		];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(1);
		expect(phases[0].phase).toBe(0);
		expect(phases[0].generators).toHaveLength(3);
	});

	it("puts status in phase 1 after its dependencies", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test" },
			{ id: "coverage", label: "Coverage" },
			{ id: "status", label: "Status" },
		];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(2);
		expect(phases[0].phase).toBe(0);
		expect(phases[0].generators.map((g) => g.id)).toContain("test");
		expect(phases[0].generators.map((g) => g.id)).toContain("coverage");
		expect(phases[1].phase).toBe(1);
		expect(phases[1].generators.map((g) => g.id)).toContain("status");
	});

	it("puts summary in phase 2 after status", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test" },
			{ id: "status", label: "Status" },
			{ id: "summary", label: "Summary" },
		];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(3);
		expect(phases[0].generators.map((g) => g.id)).toContain("test");
		expect(phases[1].generators.map((g) => g.id)).toContain("status");
		expect(phases[2].generators.map((g) => g.id)).toContain("summary");
	});

	it("returns empty for no generators", () => {
		expect(partitionByDependency([])).toEqual([]);
	});

	it("handles single generator", () => {
		const gens: ReportGenerator[] = [{ id: "test", label: "Test" }];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(1);
		expect(phases[0].generators).toHaveLength(1);
	});

	it("puts dependent generator in phase 0 when its deps are not in the run", () => {
		// status depends on test/coverage/etc, but none are in this run
		const gens: ReportGenerator[] = [{ id: "status", label: "Status" }];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(1);
		expect(phases[0].phase).toBe(0);
	});

	it("uses custom dependency map", () => {
		const customDeps = { b: ["a"] };
		const gens: ReportGenerator[] = [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
		];
		const phases = partitionByDependency(gens, customDeps);
		expect(phases).toHaveLength(2);
		expect(phases[0].generators.map((g) => g.id)).toEqual(["a"]);
		expect(phases[1].generators.map((g) => g.id)).toEqual(["b"]);
	});

	it("handles label-based IDs for generators without id", () => {
		const gens: ReportGenerator[] = [
			{ label: "Test" },
			{ label: "Coverage" },
		];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(1);
		expect(phases[0].generators).toHaveLength(2);
	});

	it("handles full pipeline ordering", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test" },
			{ id: "coverage", label: "Coverage" },
			{ id: "codebase", label: "Codebase" },
			{ id: "complexity", label: "Complexity" },
			{ id: "status", label: "Status" },
			{ id: "summary", label: "Summary" },
		];
		const phases = partitionByDependency(gens);
		expect(phases).toHaveLength(3);
		// Phase 0: test, coverage, codebase, complexity
		expect(phases[0].generators).toHaveLength(4);
		// Phase 1: status
		expect(phases[1].generators).toHaveLength(1);
		expect(phases[1].generators[0].id).toBe("status");
		// Phase 2: summary
		expect(phases[2].generators).toHaveLength(1);
		expect(phases[2].generators[0].id).toBe("summary");
	});

	it("handles transitive dependencies", () => {
		const customDeps = { c: ["b"], b: ["a"] };
		const gens: ReportGenerator[] = [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C" },
		];
		const phases = partitionByDependency(gens, customDeps);
		expect(phases).toHaveLength(3);
		expect(phases[0].generators[0].id).toBe("a");
		expect(phases[1].generators[0].id).toBe("b");
		expect(phases[2].generators[0].id).toBe("c");
	});
});

// ── collectPrerequisites ────────────────────────────────────────────

describe("collectPrerequisites", () => {
	it("returns empty for generators without prerequisites", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test" },
			{ id: "coverage", label: "Coverage" },
		];
		expect(collectPrerequisites(gens)).toEqual([]);
	});

	it("collects prerequisites from multiple generators", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test", prerequisites: ["npm run test:coverage"] },
			{ id: "codebase", label: "Codebase", prerequisites: ["npm run docs"] },
		];
		expect(collectPrerequisites(gens)).toEqual(["npm run test:coverage", "npm run docs"]);
	});

	it("deduplicates shared prerequisites", () => {
		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test", prerequisites: ["npm run test:coverage"] },
			{ id: "coverage", label: "Coverage", prerequisites: ["npm run test:coverage"] },
		];
		expect(collectPrerequisites(gens)).toEqual(["npm run test:coverage"]);
	});

	it("preserves order of first appearance", () => {
		const gens: ReportGenerator[] = [
			{ id: "a", label: "A", prerequisites: ["cmd-b", "cmd-a"] },
			{ id: "b", label: "B", prerequisites: ["cmd-a", "cmd-c"] },
		];
		expect(collectPrerequisites(gens)).toEqual(["cmd-b", "cmd-a", "cmd-c"]);
	});
});
