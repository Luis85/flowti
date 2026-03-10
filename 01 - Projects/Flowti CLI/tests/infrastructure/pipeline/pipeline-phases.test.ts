import { describe, it, expect } from "vitest";
import { resolvePhases, collectStepPrerequisites } from "../../../src/infrastructure/pipeline/pipeline-phases.js";
import type { PipelineStep } from "../../../src/infrastructure/pipeline/pipeline-types.js";

function step(id: string, deps?: string[], prereqs?: string[]): PipelineStep {
	return {
		id,
		label: id,
		dependencies: deps,
		prerequisites: prereqs,
		execute: () => ({ success: true }),
	};
}

describe("resolvePhases", () => {
	it("puts all independent steps in phase 0", () => {
		const phases = resolvePhases([step("a"), step("b"), step("c")]);
		expect(phases).toHaveLength(1);
		expect(phases[0].phase).toBe(0);
		expect(phases[0].steps).toHaveLength(3);
	});

	it("puts dependent step in phase 1", () => {
		const phases = resolvePhases([
			step("a"),
			step("b"),
			step("c", ["a", "b"]),
		]);
		expect(phases).toHaveLength(2);
		expect(phases[0].phase).toBe(0);
		expect(phases[0].steps.map((s) => s.id).sort()).toEqual(["a", "b"]);
		expect(phases[1].phase).toBe(1);
		expect(phases[1].steps[0].id).toBe("c");
	});

	it("handles transitive dependencies (3 phases)", () => {
		const phases = resolvePhases([
			step("a"),
			step("b", ["a"]),
			step("c", ["b"]),
		]);
		expect(phases).toHaveLength(3);
		expect(phases[0].steps[0].id).toBe("a");
		expect(phases[1].steps[0].id).toBe("b");
		expect(phases[2].steps[0].id).toBe("c");
	});

	it("ignores dependencies not in this run", () => {
		const phases = resolvePhases([
			step("b", ["a"]),  // "a" not in this run
		]);
		expect(phases).toHaveLength(1);
		expect(phases[0].phase).toBe(0);
	});

	it("breaks circular dependencies", () => {
		const phases = resolvePhases([
			step("a", ["b"]),
			step("b", ["a"]),
		]);
		// Should not throw; both get phase 0 or 1
		expect(phases.length).toBeGreaterThan(0);
	});

	it("returns empty for empty input", () => {
		expect(resolvePhases([])).toEqual([]);
	});

	it("handles single step with no dependencies", () => {
		const phases = resolvePhases([step("solo")]);
		expect(phases).toHaveLength(1);
		expect(phases[0].steps[0].id).toBe("solo");
	});

	it("handles report-like dependency structure", () => {
		const phases = resolvePhases([
			step("test"),
			step("coverage"),
			step("codebase"),
			step("complexity"),
			step("status", ["test", "coverage", "codebase", "complexity"]),
			step("summary", ["test", "coverage", "codebase", "complexity", "status"]),
		]);
		expect(phases).toHaveLength(3);
		// Phase 0: independent generators
		expect(phases[0].steps).toHaveLength(4);
		// Phase 1: status
		expect(phases[1].steps).toHaveLength(1);
		expect(phases[1].steps[0].id).toBe("status");
		// Phase 2: summary
		expect(phases[2].steps).toHaveLength(1);
		expect(phases[2].steps[0].id).toBe("summary");
	});
});

describe("collectStepPrerequisites", () => {
	it("returns empty for steps with no prerequisites", () => {
		expect(collectStepPrerequisites([step("a"), step("b")])).toEqual([]);
	});

	it("collects unique prerequisites", () => {
		const result = collectStepPrerequisites([
			step("a", [], ["npm run test"]),
			step("b", [], ["npm run test", "npm run build"]),
		]);
		expect(result).toEqual(["npm run test", "npm run build"]);
	});

	it("deduplicates across steps", () => {
		const result = collectStepPrerequisites([
			step("a", [], ["npm run coverage"]),
			step("b", [], ["npm run coverage"]),
		]);
		expect(result).toEqual(["npm run coverage"]);
	});

	it("preserves order of first occurrence", () => {
		const result = collectStepPrerequisites([
			step("a", [], ["cmd-b", "cmd-a"]),
			step("b", [], ["cmd-a", "cmd-c"]),
		]);
		expect(result).toEqual(["cmd-b", "cmd-a", "cmd-c"]);
	});
});
