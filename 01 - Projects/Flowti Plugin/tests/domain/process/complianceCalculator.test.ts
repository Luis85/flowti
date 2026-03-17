import { describe, it, expect } from "vitest";
import { computeProcessCompliance } from "../../../src/domain/process/complianceCalculator";
import { LIFECYCLE_PHASES } from "../../../src/domain/process/types";
import type { FeatureStage } from "../../../src/domain/featureLifecycle/types";

describe("computeProcessCompliance", () => {
	it("returns 0% for idea stage (phase 1 is active, no phases completed before it)", () => {
		const result = computeProcessCompliance({ name: "F1", stage: "idea" });
		// "idea" maps to phase 1 — only phase 1 is satisfied (1 <= 1)
		expect(result.featureName).toBe("F1");
		expect(result.processName).toBe("Development Lifecycle");
		expect(result.percentage).toBe(10); // 1/10 = 10%
		expect(result.steps[0].satisfied).toBe(true);
		expect(result.steps[1].satisfied).toBe(false);
	});

	it("returns correct percentage for draft stage", () => {
		const result = computeProcessCompliance({ name: "F2", stage: "draft" });
		// "draft" maps to phase 2 — phases 1-2 satisfied
		expect(result.percentage).toBe(20); // 2/10 = 20%
		expect(result.steps.filter((s) => s.satisfied)).toHaveLength(2);
	});

	it("returns correct percentage for approved stage", () => {
		const result = computeProcessCompliance({ name: "F3", stage: "approved" });
		// "approved" maps to phase 4 — phases 1-4 satisfied
		expect(result.percentage).toBe(40);
		expect(result.steps.filter((s) => s.satisfied)).toHaveLength(4);
	});

	it("returns correct percentage for in-progress stage", () => {
		const result = computeProcessCompliance({ name: "F4", stage: "in-progress" });
		// "in-progress" maps to phase 6 — phases 1-6 satisfied
		expect(result.percentage).toBe(60);
		expect(result.steps.filter((s) => s.satisfied)).toHaveLength(6);
	});

	it("returns correct percentage for review stage", () => {
		const result = computeProcessCompliance({ name: "F5", stage: "review" });
		// "review" maps to phase 8 — phases 1-8 satisfied
		expect(result.percentage).toBe(80);
		expect(result.steps.filter((s) => s.satisfied)).toHaveLength(8);
	});

	it("returns 100% for done stage", () => {
		const result = computeProcessCompliance({ name: "F6", stage: "done" });
		// "done" maps to phase 10 — all 10 phases satisfied
		expect(result.percentage).toBe(100);
		expect(result.steps.every((s) => s.satisfied)).toBe(true);
	});

	it("includes evidence for satisfied steps", () => {
		const result = computeProcessCompliance({ name: "F7", stage: "approved" });
		const satisfied = result.steps.filter((s) => s.satisfied);
		for (const step of satisfied) {
			expect(step.evidence).toContain("approved");
			expect(step.evidence).toContain(`phase ${step.phase}`);
		}
	});

	it("has no evidence for unsatisfied steps", () => {
		const result = computeProcessCompliance({ name: "F8", stage: "draft" });
		const unsatisfied = result.steps.filter((s) => !s.satisfied);
		for (const step of unsatisfied) {
			expect(step.evidence).toBeUndefined();
		}
	});

	it("returns all 10 lifecycle phases as steps", () => {
		const result = computeProcessCompliance({ name: "F9", stage: "idea" });
		expect(result.steps).toHaveLength(LIFECYCLE_PHASES.length);
		expect(result.steps).toHaveLength(10);
		for (let i = 0; i < LIFECYCLE_PHASES.length; i++) {
			expect(result.steps[i].phase).toBe(LIFECYCLE_PHASES[i].phase);
			expect(result.steps[i].name).toBe(LIFECYCLE_PHASES[i].name);
		}
	});

	it("accepts custom process name", () => {
		const result = computeProcessCompliance({ name: "F10", stage: "idea" }, "Custom Process");
		expect(result.processName).toBe("Custom Process");
	});
});
