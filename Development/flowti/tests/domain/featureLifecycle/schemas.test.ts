import { describe, it, expect } from "vitest";
import { PRDFrontmatterSchema } from "../../../src/domain/featureLifecycle/schemas";

describe("PRDFrontmatterSchema", () => {
	it("parses valid frontmatter", () => {
		const result = PRDFrontmatterSchema.safeParse({
			type: "ProductRequirementsDocument",
			stage: "approved",
			domain: "Flowti",
			maturity: "L2",
			related_events: ["feature.scored"],
			maturity_score_strategy: 5,
			maturity_score_scope: 4,
			business_value: 5,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.stage).toBe("approved");
			expect(result.data.maturity_score_strategy).toBe(5);
			expect(result.data.maturity_score_scope).toBe(4);
			expect(result.data.business_value).toBe(5);
		}
	});

	it("provides defaults for missing fields", () => {
		const result = PRDFrontmatterSchema.parse({});
		expect(result.type).toBe("unknown");
		expect(result.stage).toBe("idea");
		expect(result.domain).toBe("unknown");
		expect(result.maturity).toBeNull();
		expect(result.related_events).toEqual([]);
		expect(result.maturity_score_strategy).toBeNull();
		expect(result.business_value).toBeNull();
	});

	it("coerces string numbers to numbers", () => {
		const result = PRDFrontmatterSchema.parse({
			maturity_score_strategy: "4",
			business_value: "3",
		});
		expect(result.maturity_score_strategy).toBe(4);
		expect(result.business_value).toBe(3);
	});

	it("coerces null/undefined/empty to null", () => {
		const result = PRDFrontmatterSchema.parse({
			maturity_score_strategy: null,
			maturity_score_scope: undefined,
			maturity_score_architecture: "",
		});
		expect(result.maturity_score_strategy).toBeNull();
		expect(result.maturity_score_scope).toBeNull();
		expect(result.maturity_score_architecture).toBeNull();
	});

	it("clamps scores to 0-5 range", () => {
		const result = PRDFrontmatterSchema.safeParse({
			maturity_score_strategy: 10,
		});
		expect(result.success).toBe(false);
	});

	it("rejects negative scores", () => {
		const result = PRDFrontmatterSchema.safeParse({
			maturity_score_strategy: -1,
		});
		expect(result.success).toBe(false);
	});

	it("allows passthrough of unknown fields", () => {
		const result = PRDFrontmatterSchema.parse({
			stage: "draft",
			custom_field: "hello",
		});
		expect(result.stage).toBe("draft");
		expect((result as Record<string, unknown>).custom_field).toBe("hello");
	});

	it("handles all 7 FRI dimensions", () => {
		const result = PRDFrontmatterSchema.parse({
			maturity_score_strategy: 5,
			maturity_score_scope: 4,
			maturity_score_architecture: 3,
			maturity_score_event_integration: 4,
			maturity_score_data_model: 3,
			maturity_score_ui_consistency: 2,
			maturity_score_validation_testing: 1,
		});
		expect(result.maturity_score_strategy).toBe(5);
		expect(result.maturity_score_scope).toBe(4);
		expect(result.maturity_score_architecture).toBe(3);
		expect(result.maturity_score_event_integration).toBe(4);
		expect(result.maturity_score_data_model).toBe(3);
		expect(result.maturity_score_ui_consistency).toBe(2);
		expect(result.maturity_score_validation_testing).toBe(1);
	});

	it("handles all 7 prioritization dimensions", () => {
		const result = PRDFrontmatterSchema.parse({
			business_value: 5,
			implementation_cost: 4,
			maintenance_cost: 2,
			discovery_cost: 1,
			design_cost: 3,
			test_cost: 3,
			priority: 2,
		});
		expect(result.business_value).toBe(5);
		expect(result.implementation_cost).toBe(4);
		expect(result.maintenance_cost).toBe(2);
		expect(result.discovery_cost).toBe(1);
		expect(result.design_cost).toBe(3);
		expect(result.test_cost).toBe(3);
		expect(result.priority).toBe(2);
	});
});
