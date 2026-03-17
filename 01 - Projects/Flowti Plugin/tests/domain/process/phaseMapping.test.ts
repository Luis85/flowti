import { describe, it, expect } from "vitest";
import {
	getPhasesForStage,
	getStageForPhase,
	getPhase,
	getActivePhase,
	getCompletedPhases,
	getPhaseProgress,
} from "../../../src/domain/process/phaseMapping";
import type { FeatureStage } from "../../../src/domain/featureLifecycle/types";

describe("phaseMapping", () => {
	describe("getPhasesForStage", () => {
		it("returns phase 1 for idea", () => {
			const phases = getPhasesForStage("idea");
			expect(phases).toHaveLength(1);
			expect(phases[0].phase).toBe(1);
		});

		it("returns phases 2-3 for draft", () => {
			const phases = getPhasesForStage("draft");
			expect(phases).toHaveLength(2);
			expect(phases.map((p) => p.phase)).toEqual([2, 3]);
		});

		it("returns phases 4-5 for approved", () => {
			const phases = getPhasesForStage("approved");
			expect(phases).toHaveLength(2);
			expect(phases.map((p) => p.phase)).toEqual([4, 5]);
		});

		it("returns phases 6-7 for in-progress", () => {
			const phases = getPhasesForStage("in-progress");
			expect(phases).toHaveLength(2);
			expect(phases.map((p) => p.phase)).toEqual([6, 7]);
		});

		it("returns phases 8-9 for review", () => {
			const phases = getPhasesForStage("review");
			expect(phases).toHaveLength(2);
			expect(phases.map((p) => p.phase)).toEqual([8, 9]);
		});

		it("returns phase 10 for done", () => {
			const phases = getPhasesForStage("done");
			expect(phases).toHaveLength(1);
			expect(phases[0].phase).toBe(10);
		});
	});

	describe("getStageForPhase", () => {
		it.each([
			[1, "idea"],
			[2, "draft"],
			[3, "draft"],
			[4, "approved"],
			[5, "approved"],
			[6, "in-progress"],
			[7, "in-progress"],
			[8, "review"],
			[9, "review"],
			[10, "done"],
		] as [number, FeatureStage][])("phase %d maps to '%s'", (phase, expected) => {
			expect(getStageForPhase(phase)).toBe(expected);
		});

		it("returns undefined for invalid phase", () => {
			expect(getStageForPhase(0)).toBeUndefined();
			expect(getStageForPhase(11)).toBeUndefined();
		});
	});

	describe("getPhase", () => {
		it("returns phase by number", () => {
			const phase = getPhase(6);
			expect(phase?.name).toBe("Development");
			expect(phase?.stage).toBe("in-progress");
		});

		it("returns undefined for invalid number", () => {
			expect(getPhase(99)).toBeUndefined();
		});
	});

	describe("getActivePhase", () => {
		it("returns first phase for idea stage", () => {
			const phase = getActivePhase({ stage: "idea" });
			expect(phase?.phase).toBe(1);
		});

		it("returns phase 6 for in-progress", () => {
			const phase = getActivePhase({ stage: "in-progress" });
			expect(phase?.phase).toBe(6);
		});

		it("returns phase 10 for done", () => {
			const phase = getActivePhase({ stage: "done" });
			expect(phase?.phase).toBe(10);
		});
	});

	describe("getCompletedPhases", () => {
		it("returns 1 phase for idea", () => {
			expect(getCompletedPhases({ stage: "idea" })).toHaveLength(1);
		});

		it("returns 6 phases for in-progress", () => {
			expect(getCompletedPhases({ stage: "in-progress" })).toHaveLength(6);
		});

		it("returns all 10 phases for done", () => {
			expect(getCompletedPhases({ stage: "done" })).toHaveLength(10);
		});
	});

	describe("getPhaseProgress", () => {
		it("returns 10% for idea", () => {
			expect(getPhaseProgress({ stage: "idea" })).toBe(10);
		});

		it("returns 60% for in-progress", () => {
			expect(getPhaseProgress({ stage: "in-progress" })).toBe(60);
		});

		it("returns 100% for done", () => {
			expect(getPhaseProgress({ stage: "done" })).toBe(100);
		});
	});
});
