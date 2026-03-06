import { describe, it, expect } from "vitest";
import {
	FEATURE_STAGES,
	STAGE_LABELS,
	LEGACY_STAGE_MAP,
	STAGE_GATE_MAP,
	GATE_LABELS,
	FRI_DIMENSIONS,
	FRI_DIMENSION_LABELS,
	FRI_LEVEL_THRESHOLDS,
	PRIORITIZATION_DIMENSIONS,
	PRIORITIZATION_LABELS,
	DEFAULT_FEATURE_LIFECYCLE_STATE,
} from "../../../src/domain/featureLifecycle/types";
import type { FeatureStage, GateName, FRIDimension } from "../../../src/domain/featureLifecycle/types";

describe("Feature Lifecycle types", () => {
	describe("FEATURE_STAGES", () => {
		it("has 6 stages in correct order", () => {
			expect(FEATURE_STAGES).toEqual([
				"idea", "draft", "approved", "in-progress", "review", "done",
			]);
		});

		it("each stage has a display label", () => {
			for (const stage of FEATURE_STAGES) {
				expect(STAGE_LABELS[stage]).toBeDefined();
				expect(typeof STAGE_LABELS[stage]).toBe("string");
			}
		});
	});

	describe("LEGACY_STAGE_MAP", () => {
		it("maps legacy values to valid stages", () => {
			const mapped: FeatureStage[] = Object.values(LEGACY_STAGE_MAP);
			for (const stage of mapped) {
				expect(FEATURE_STAGES).toContain(stage);
			}
		});

		it.each([
			["new", "idea"],
			["open", "draft"],
			["planned", "approved"],
			["development", "in-progress"],
			["active", "in-progress"],
			["in_progress", "in-progress"],
			["testing", "review"],
			["completed", "done"],
			["closed", "done"],
			["shipped", "done"],
		] as const)("normalizes '%s' to '%s'", (legacy, expected) => {
			expect(LEGACY_STAGE_MAP[legacy]).toBe(expected);
		});
	});

	describe("STAGE_GATE_MAP", () => {
		it("idea has no gate", () => {
			expect(STAGE_GATE_MAP["idea"]).toBeNull();
		});

		it.each([
			["draft", "problem"],
			["approved", "design"],
			["in-progress", "readiness"],
			["review", "build"],
			["done", "quality"],
		] as [FeatureStage, GateName][])("stage '%s' maps to gate '%s'", (stage, gate) => {
			expect(STAGE_GATE_MAP[stage]).toBe(gate);
		});

		it("all gates have display labels", () => {
			const gates = Object.values(STAGE_GATE_MAP).filter(Boolean) as GateName[];
			for (const gate of gates) {
				expect(GATE_LABELS[gate]).toBeDefined();
			}
		});
	});

	describe("FRI_DIMENSIONS", () => {
		it("has 7 dimensions", () => {
			expect(FRI_DIMENSIONS).toHaveLength(7);
		});

		it("each dimension has a display label", () => {
			for (const dim of FRI_DIMENSIONS) {
				expect(FRI_DIMENSION_LABELS[dim]).toBeDefined();
			}
		});
	});

	describe("FRI_LEVEL_THRESHOLDS", () => {
		it("has 5 levels in descending order", () => {
			expect(FRI_LEVEL_THRESHOLDS).toHaveLength(5);
			for (let i = 1; i < FRI_LEVEL_THRESHOLDS.length; i++) {
				expect(FRI_LEVEL_THRESHOLDS[i].min).toBeLessThan(FRI_LEVEL_THRESHOLDS[i - 1].min);
			}
		});

		it("lowest threshold starts at 0", () => {
			expect(FRI_LEVEL_THRESHOLDS[FRI_LEVEL_THRESHOLDS.length - 1].min).toBe(0);
		});

		it("highest threshold is production-ready at 31", () => {
			expect(FRI_LEVEL_THRESHOLDS[0]).toEqual({
				min: 31, level: "production-ready", label: "Production Ready",
			});
		});
	});

	describe("PRIORITIZATION_DIMENSIONS", () => {
		it("has 7 dimensions", () => {
			expect(PRIORITIZATION_DIMENSIONS).toHaveLength(7);
		});

		it("each dimension has a display label", () => {
			for (const dim of PRIORITIZATION_DIMENSIONS) {
				expect(PRIORITIZATION_LABELS[dim]).toBeDefined();
			}
		});

		it("includes business_value as first dimension", () => {
			expect(PRIORITIZATION_DIMENSIONS[0]).toBe("business_value");
		});
	});

	describe("DEFAULT_FEATURE_LIFECYCLE_STATE", () => {
		it("has empty sessions array", () => {
			expect(DEFAULT_FEATURE_LIFECYCLE_STATE.sessions).toEqual([]);
		});

		it("has null active session", () => {
			expect(DEFAULT_FEATURE_LIFECYCLE_STATE.activeSession).toBeNull();
		});
	});
});
