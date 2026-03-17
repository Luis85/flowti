import { describe, it, expect } from "vitest";
import {
	normalizeStage,
	extractFRI,
	extractPrioritization,
	getNextStage,
	isValidTransition,
} from "../../../src/domain/featureLifecycle/FeatureLifecycleService";
import { PRDFrontmatterSchema } from "../../../src/domain/featureLifecycle/schemas";

describe("normalizeStage", () => {
	it.each([
		["idea", "idea"],
		["draft", "draft"],
		["approved", "approved"],
		["in-progress", "in-progress"],
		["review", "review"],
		["done", "done"],
	] as const)("passes through valid stage '%s'", (input, expected) => {
		expect(normalizeStage(input)).toBe(expected);
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
	] as const)("normalizes legacy '%s' to '%s'", (input, expected) => {
		expect(normalizeStage(input)).toBe(expected);
	});

	it("is case-insensitive", () => {
		expect(normalizeStage("APPROVED")).toBe("approved");
		expect(normalizeStage("Draft")).toBe("draft");
		expect(normalizeStage("IN-PROGRESS")).toBe("in-progress");
	});

	it("trims whitespace", () => {
		expect(normalizeStage("  draft  ")).toBe("draft");
	});

	it("defaults unknown values to idea", () => {
		expect(normalizeStage("random")).toBe("idea");
		expect(normalizeStage("")).toBe("idea");
		expect(normalizeStage("foo-bar")).toBe("idea");
	});
});

describe("extractFRI", () => {
	it("returns null when no scores are present", () => {
		const fm = PRDFrontmatterSchema.parse({});
		expect(extractFRI(fm)).toBeNull();
	});

	it("returns null when all scores are 0", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 0,
			maturity_score_scope: 0,
		});
		expect(extractFRI(fm)).toBeNull();
	});

	it("computes total from all 7 dimensions", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 5,
			maturity_score_scope: 5,
			maturity_score_architecture: 4,
			maturity_score_event_integration: 4,
			maturity_score_data_model: 4,
			maturity_score_ui_consistency: 3,
			maturity_score_validation_testing: 2,
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(27);
		expect(result.dimensions.strategy).toBe(5);
		expect(result.dimensions.validation_testing).toBe(2);
	});

	it("determines production-ready level (31-35)", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 5,
			maturity_score_scope: 5,
			maturity_score_architecture: 5,
			maturity_score_event_integration: 5,
			maturity_score_data_model: 5,
			maturity_score_ui_consistency: 3,
			maturity_score_validation_testing: 3,
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(31);
		expect(result.level).toBe("production-ready");
		expect(result.levelLabel).toBe("Production Ready");
	});

	it("determines integration-ready level (26-30)", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 5,
			maturity_score_scope: 5,
			maturity_score_architecture: 4,
			maturity_score_event_integration: 4,
			maturity_score_data_model: 4,
			maturity_score_ui_consistency: 3,
			maturity_score_validation_testing: 2,
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(27);
		expect(result.level).toBe("integration-ready");
	});

	it("determines technically-ready level (19-25)", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 4,
			maturity_score_scope: 3,
			maturity_score_architecture: 3,
			maturity_score_event_integration: 3,
			maturity_score_data_model: 3,
			maturity_score_ui_consistency: 2,
			maturity_score_validation_testing: 2,
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(20);
		expect(result.level).toBe("technically-ready");
	});

	it("determines conceptual level (11-18)", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 3,
			maturity_score_scope: 2,
			maturity_score_architecture: 2,
			maturity_score_event_integration: 2,
			maturity_score_data_model: 2,
			maturity_score_ui_consistency: 1,
			maturity_score_validation_testing: 0,
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(12);
		expect(result.level).toBe("conceptual");
	});

	it("determines not-ready level (0-10)", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 2,
			maturity_score_scope: 1,
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(3);
		expect(result.level).toBe("not-ready");
		expect(result.levelLabel).toBe("Not Ready");
	});

	it("treats null dimensions as 0", () => {
		const fm = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 5,
			// All others default to null → treated as 0
		});
		const result = extractFRI(fm)!;
		expect(result.total).toBe(5);
		expect(result.dimensions.scope).toBe(0);
	});
});

describe("extractPrioritization", () => {
	it("returns null when no scores are present", () => {
		const fm = PRDFrontmatterSchema.parse({});
		expect(extractPrioritization(fm)).toBeNull();
	});

	it("extracts all 7 dimensions", () => {
		const fm = PRDFrontmatterSchema.parse({
			business_value: 5,
			implementation_cost: 4,
			maintenance_cost: 2,
			discovery_cost: 1,
			design_cost: 3,
			test_cost: 3,
			priority: 2,
		});
		const result = extractPrioritization(fm)!;
		expect(result.dimensions.business_value).toBe(5);
		expect(result.dimensions.implementation_cost).toBe(4);
		expect(result.dimensions.priority).toBe(2);
	});

	it("computes priority signal: business_value - avg(costs)", () => {
		const fm = PRDFrontmatterSchema.parse({
			business_value: 5,
			implementation_cost: 4,
			maintenance_cost: 2,
			discovery_cost: 1,
			design_cost: 3,
			test_cost: 3,
		});
		const result = extractPrioritization(fm)!;
		// avg costs = (1+3+4+3+2)/5 = 13/5 = 2.6, signal = 5 - 2.6 = 2.4 → rounded to 2
		expect(result.signal).toBe(2);
	});

	it("returns null signal when business_value is missing", () => {
		const fm = PRDFrontmatterSchema.parse({
			implementation_cost: 4,
		});
		const result = extractPrioritization(fm)!;
		expect(result.signal).toBeNull();
	});

	it("returns null signal when no costs are present", () => {
		const fm = PRDFrontmatterSchema.parse({
			business_value: 5,
		});
		const result = extractPrioritization(fm)!;
		expect(result.signal).toBeNull();
	});

	it("handles partial cost data", () => {
		const fm = PRDFrontmatterSchema.parse({
			business_value: 5,
			implementation_cost: 3,
			// Only 1 cost dimension
		});
		const result = extractPrioritization(fm)!;
		// avg costs = 3/1 = 3, signal = 5 - 3 = 2
		expect(result.signal).toBe(2);
	});
});

describe("getNextStage", () => {
	it.each([
		["idea", "draft"],
		["draft", "approved"],
		["approved", "in-progress"],
		["in-progress", "review"],
		["review", "done"],
	] as const)("next after '%s' is '%s'", (current, expected) => {
		expect(getNextStage(current)).toBe(expected);
	});

	it("returns null for done (end of pipeline)", () => {
		expect(getNextStage("done")).toBeNull();
	});
});

describe("isValidTransition", () => {
	it("accepts forward-by-one transitions", () => {
		expect(isValidTransition("idea", "draft")).toBe(true);
		expect(isValidTransition("draft", "approved")).toBe(true);
		expect(isValidTransition("review", "done")).toBe(true);
	});

	it("rejects skip transitions", () => {
		expect(isValidTransition("idea", "approved")).toBe(false);
		expect(isValidTransition("idea", "done")).toBe(false);
	});

	it("rejects backward transitions", () => {
		expect(isValidTransition("approved", "draft")).toBe(false);
		expect(isValidTransition("done", "review")).toBe(false);
	});

	it("rejects same-stage transition", () => {
		expect(isValidTransition("idea", "idea")).toBe(false);
	});
});
