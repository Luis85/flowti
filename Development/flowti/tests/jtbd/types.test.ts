import { describe, it, expect } from "vitest";
import {
	JTBDSchema,
	JTBDStatusSchema,
	JTBDFrontmatterSchema,
	ScaleSchema,
	JTBD_STATUSES,
	SCALE_VALUES,
	calculateOpportunityScore,
	getOpportunityLevel,
	getJTBDStatusLabel,
	getJTBDStatusIcon,
	getScaleLabel,
} from "../../src/jtbd/types";
import type { UUID } from "../../src/utils/types";

describe("JTBD Types", () => {
	describe("JTBD_STATUSES", () => {
		it("should have exactly 3 statuses", () => {
			expect(JTBD_STATUSES).toHaveLength(3);
		});

		it("should contain Active, Validated, and Archived", () => {
			expect(JTBD_STATUSES).toContain("Active");
			expect(JTBD_STATUSES).toContain("Validated");
			expect(JTBD_STATUSES).toContain("Archived");
		});
	});

	describe("SCALE_VALUES", () => {
		it("should have exactly 5 values", () => {
			expect(SCALE_VALUES).toHaveLength(5);
		});

		it("should contain 1 through 5", () => {
			expect(SCALE_VALUES).toContain(1);
			expect(SCALE_VALUES).toContain(2);
			expect(SCALE_VALUES).toContain(3);
			expect(SCALE_VALUES).toContain(4);
			expect(SCALE_VALUES).toContain(5);
		});
	});

	describe("JTBDStatusSchema", () => {
		it("should accept valid statuses", () => {
			expect(JTBDStatusSchema.parse("Active")).toBe("Active");
			expect(JTBDStatusSchema.parse("Validated")).toBe("Validated");
			expect(JTBDStatusSchema.parse("Archived")).toBe("Archived");
		});

		it("should reject invalid statuses", () => {
			expect(() => JTBDStatusSchema.parse("Invalid")).toThrow();
			expect(() => JTBDStatusSchema.parse("")).toThrow();
		});
	});

	describe("ScaleSchema", () => {
		it("should accept values 1-5", () => {
			expect(ScaleSchema.parse(1)).toBe(1);
			expect(ScaleSchema.parse(3)).toBe(3);
			expect(ScaleSchema.parse(5)).toBe(5);
		});

		it("should reject values below 1", () => {
			expect(() => ScaleSchema.parse(0)).toThrow();
			expect(() => ScaleSchema.parse(-1)).toThrow();
		});

		it("should reject values above 5", () => {
			expect(() => ScaleSchema.parse(6)).toThrow();
			expect(() => ScaleSchema.parse(10)).toThrow();
		});

		it("should reject non-integers", () => {
			expect(() => ScaleSchema.parse(3.5)).toThrow();
		});
	});

	describe("JTBDSchema", () => {
		const validJTBD = {
			id: "550e8400-e29b-41d4-a716-446655440000" as UUID,
			jobStatement: "Track project progress at a glance",
			context: "When managing a software project",
			motivation: "I want to see progress quickly",
			outcome: "So I can make informed decisions",
			importance: 4,
			satisfaction: 2,
			status: "Active",
			solutionId: "660e8400-e29b-41d4-a716-446655440000" as UUID,
			linkedRequirements: ["770e8400-e29b-41d4-a716-446655440000" as UUID],
			linkedIdeas: ["880e8400-e29b-41d4-a716-446655440000" as UUID],
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid JTBD data", () => {
			const result = JTBDSchema.safeParse(validJTBD);
			expect(result.success).toBe(true);
		});

		it("should require jobStatement", () => {
			const invalid = { ...validJTBD, jobStatement: "" };
			const result = JTBDSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for id", () => {
			const invalid = { ...validJTBD, id: "not-a-uuid" };
			const result = JTBDSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for solutionId", () => {
			const invalid = { ...validJTBD, solutionId: "not-a-uuid" };
			const result = JTBDSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should accept optional context", () => {
			const withoutContext = { ...validJTBD };
			delete (withoutContext as Record<string, unknown>).context;
			const result = JTBDSchema.safeParse(withoutContext);
			expect(result.success).toBe(true);
		});

		it("should accept optional motivation", () => {
			const withoutMotivation = { ...validJTBD };
			delete (withoutMotivation as Record<string, unknown>).motivation;
			const result = JTBDSchema.safeParse(withoutMotivation);
			expect(result.success).toBe(true);
		});

		it("should accept optional outcome", () => {
			const withoutOutcome = { ...validJTBD };
			delete (withoutOutcome as Record<string, unknown>).outcome;
			const result = JTBDSchema.safeParse(withoutOutcome);
			expect(result.success).toBe(true);
		});

		it("should default importance to 3", () => {
			const withoutImportance = { ...validJTBD };
			delete (withoutImportance as Record<string, unknown>).importance;
			const result = JTBDSchema.safeParse(withoutImportance);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.importance).toBe(3);
			}
		});

		it("should default satisfaction to 3", () => {
			const withoutSatisfaction = { ...validJTBD };
			delete (withoutSatisfaction as Record<string, unknown>).satisfaction;
			const result = JTBDSchema.safeParse(withoutSatisfaction);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.satisfaction).toBe(3);
			}
		});

		it("should default status to Active", () => {
			const withoutStatus = { ...validJTBD };
			delete (withoutStatus as Record<string, unknown>).status;
			const result = JTBDSchema.safeParse(withoutStatus);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.status).toBe("Active");
			}
		});

		it("should accept optional linkedRequirements", () => {
			const withoutLinks = { ...validJTBD };
			delete (withoutLinks as Record<string, unknown>).linkedRequirements;
			const result = JTBDSchema.safeParse(withoutLinks);
			expect(result.success).toBe(true);
		});

		it("should accept optional linkedIdeas", () => {
			const withoutLinks = { ...validJTBD };
			delete (withoutLinks as Record<string, unknown>).linkedIdeas;
			const result = JTBDSchema.safeParse(withoutLinks);
			expect(result.success).toBe(true);
		});

		it("should validate linkedRequirements as UUIDs", () => {
			const invalidLinks = { ...validJTBD, linkedRequirements: ["not-a-uuid"] };
			const result = JTBDSchema.safeParse(invalidLinks);
			expect(result.success).toBe(false);
		});

		it("should validate linkedIdeas as UUIDs", () => {
			const invalidLinks = { ...validJTBD, linkedIdeas: ["not-a-uuid"] };
			const result = JTBDSchema.safeParse(invalidLinks);
			expect(result.success).toBe(false);
		});
	});

	describe("JTBDFrontmatterSchema", () => {
		const validFrontmatter = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			status: "Active",
			solutionId: "660e8400-e29b-41d4-a716-446655440000",
			importance: 4,
			satisfaction: 2,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid frontmatter", () => {
			const result = JTBDFrontmatterSchema.safeParse(validFrontmatter);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with linkedRequirements", () => {
			const withLinks = {
				...validFrontmatter,
				linkedRequirements: ["770e8400-e29b-41d4-a716-446655440000"],
			};
			const result = JTBDFrontmatterSchema.safeParse(withLinks);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with linkedIdeas", () => {
			const withLinks = {
				...validFrontmatter,
				linkedIdeas: ["880e8400-e29b-41d4-a716-446655440000"],
			};
			const result = JTBDFrontmatterSchema.safeParse(withLinks);
			expect(result.success).toBe(true);
		});

		it("should reject frontmatter without required fields", () => {
			const withoutId = { ...validFrontmatter };
			delete (withoutId as Record<string, unknown>).id;
			const result = JTBDFrontmatterSchema.safeParse(withoutId);
			expect(result.success).toBe(false);
		});
	});

	describe("Helper Functions", () => {
		describe("calculateOpportunityScore", () => {
			it("should calculate score correctly for high opportunity", () => {
				// importance=5, satisfaction=1 -> 5 + max(5-1, 0) = 5 + 4 = 9
				expect(calculateOpportunityScore(5, 1)).toBe(9);
			});

			it("should calculate score correctly for medium opportunity", () => {
				// importance=3, satisfaction=2 -> 3 + max(3-2, 0) = 3 + 1 = 4
				expect(calculateOpportunityScore(3, 2)).toBe(4);
			});

			it("should calculate score correctly for low opportunity", () => {
				// importance=2, satisfaction=5 -> 2 + max(2-5, 0) = 2 + 0 = 2
				expect(calculateOpportunityScore(2, 5)).toBe(2);
			});

			it("should calculate score correctly when satisfaction equals importance", () => {
				// importance=3, satisfaction=3 -> 3 + max(3-3, 0) = 3 + 0 = 3
				expect(calculateOpportunityScore(3, 3)).toBe(3);
			});

			it("should calculate maximum score of 10", () => {
				// importance=5, satisfaction=0 (if allowed) -> 5 + 5 = 10
				expect(calculateOpportunityScore(5, 0)).toBe(10);
			});
		});

		describe("getOpportunityLevel", () => {
			it("should return high for scores 7-10", () => {
				expect(getOpportunityLevel(7)).toBe("high");
				expect(getOpportunityLevel(8)).toBe("high");
				expect(getOpportunityLevel(9)).toBe("high");
				expect(getOpportunityLevel(10)).toBe("high");
			});

			it("should return medium for scores 4-6", () => {
				expect(getOpportunityLevel(4)).toBe("medium");
				expect(getOpportunityLevel(5)).toBe("medium");
				expect(getOpportunityLevel(6)).toBe("medium");
			});

			it("should return low for scores 1-3", () => {
				expect(getOpportunityLevel(1)).toBe("low");
				expect(getOpportunityLevel(2)).toBe("low");
				expect(getOpportunityLevel(3)).toBe("low");
			});
		});

		describe("getJTBDStatusLabel", () => {
			it("should return correct labels", () => {
				expect(getJTBDStatusLabel("Active")).toBe("Active");
				expect(getJTBDStatusLabel("Validated")).toBe("Validated");
				expect(getJTBDStatusLabel("Archived")).toBe("Archived");
			});
		});

		describe("getJTBDStatusIcon", () => {
			it("should return correct icons", () => {
				expect(getJTBDStatusIcon("Active")).toBe("target");
				expect(getJTBDStatusIcon("Validated")).toBe("check-circle-2");
				expect(getJTBDStatusIcon("Archived")).toBe("archive");
			});
		});

		describe("getScaleLabel", () => {
			it("should return correct importance labels", () => {
				expect(getScaleLabel(1, "importance")).toBe("Not Important");
				expect(getScaleLabel(3, "importance")).toBe("Moderately Important");
				expect(getScaleLabel(5, "importance")).toBe("Extremely Important");
			});

			it("should return correct satisfaction labels", () => {
				expect(getScaleLabel(1, "satisfaction")).toBe("Very Dissatisfied");
				expect(getScaleLabel(3, "satisfaction")).toBe("Neutral");
				expect(getScaleLabel(5, "satisfaction")).toBe("Very Satisfied");
			});
		});
	});
});
