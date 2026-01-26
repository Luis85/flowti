import { describe, it, expect } from "vitest";
import {
	RequirementSchema,
	RequirementStatusSchema,
	RequirementFrontmatterSchema,
	PrioritySchema,
	REQUIREMENT_STATUSES,
	PRIORITIES,
	getRequirementStatusLabel,
	getRequirementStatusIcon,
	getPriorityLabel,
	getPriorityIcon,
} from "../../src/requirements/types";
import type { UUID } from "../../src/utils/types";

describe("Requirements Types", () => {
	describe("REQUIREMENT_STATUSES", () => {
		it("should have exactly 4 statuses", () => {
			expect(REQUIREMENT_STATUSES).toHaveLength(4);
		});

		it("should contain Proposed, Approved, Satisfied, and Obsolete", () => {
			expect(REQUIREMENT_STATUSES).toContain("Proposed");
			expect(REQUIREMENT_STATUSES).toContain("Approved");
			expect(REQUIREMENT_STATUSES).toContain("Satisfied");
			expect(REQUIREMENT_STATUSES).toContain("Obsolete");
		});
	});

	describe("PRIORITIES", () => {
		it("should have exactly 3 priorities", () => {
			expect(PRIORITIES).toHaveLength(3);
		});

		it("should contain High, Medium, and Low", () => {
			expect(PRIORITIES).toContain("High");
			expect(PRIORITIES).toContain("Medium");
			expect(PRIORITIES).toContain("Low");
		});
	});

	describe("RequirementStatusSchema", () => {
		it("should accept valid statuses", () => {
			expect(RequirementStatusSchema.parse("Proposed")).toBe("Proposed");
			expect(RequirementStatusSchema.parse("Approved")).toBe("Approved");
			expect(RequirementStatusSchema.parse("Satisfied")).toBe("Satisfied");
			expect(RequirementStatusSchema.parse("Obsolete")).toBe("Obsolete");
		});

		it("should reject invalid statuses", () => {
			expect(() => RequirementStatusSchema.parse("Invalid")).toThrow();
			expect(() => RequirementStatusSchema.parse("")).toThrow();
		});
	});

	describe("PrioritySchema", () => {
		it("should accept valid priorities", () => {
			expect(PrioritySchema.parse("High")).toBe("High");
			expect(PrioritySchema.parse("Medium")).toBe("Medium");
			expect(PrioritySchema.parse("Low")).toBe("Low");
		});

		it("should reject invalid priorities", () => {
			expect(() => PrioritySchema.parse("Invalid")).toThrow();
			expect(() => PrioritySchema.parse("Critical")).toThrow();
		});
	});

	describe("RequirementSchema", () => {
		const validRequirement = {
			id: "550e8400-e29b-41d4-a716-446655440000" as UUID,
			title: "Test Requirement",
			description: "A test description",
			priority: "High",
			status: "Proposed",
			solutionId: "660e8400-e29b-41d4-a716-446655440000" as UUID,
			acceptanceCriteria: ["Criterion 1", "Criterion 2"],
			linkedIdeas: ["770e8400-e29b-41d4-a716-446655440000" as UUID],
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid requirement data", () => {
			const result = RequirementSchema.safeParse(validRequirement);
			expect(result.success).toBe(true);
		});

		it("should require title", () => {
			const invalid = { ...validRequirement, title: "" };
			const result = RequirementSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for id", () => {
			const invalid = { ...validRequirement, id: "not-a-uuid" };
			const result = RequirementSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for solutionId", () => {
			const invalid = { ...validRequirement, solutionId: "not-a-uuid" };
			const result = RequirementSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should accept optional description", () => {
			const withoutDesc = { ...validRequirement };
			delete (withoutDesc as Record<string, unknown>).description;
			const result = RequirementSchema.safeParse(withoutDesc);
			expect(result.success).toBe(true);
		});

		it("should accept optional acceptanceCriteria", () => {
			const withoutCriteria = { ...validRequirement };
			delete (withoutCriteria as Record<string, unknown>).acceptanceCriteria;
			const result = RequirementSchema.safeParse(withoutCriteria);
			expect(result.success).toBe(true);
		});

		it("should accept optional linkedIdeas", () => {
			const withoutIdeas = { ...validRequirement };
			delete (withoutIdeas as Record<string, unknown>).linkedIdeas;
			const result = RequirementSchema.safeParse(withoutIdeas);
			expect(result.success).toBe(true);
		});

		it("should default priority to Medium", () => {
			const withoutPriority = { ...validRequirement };
			delete (withoutPriority as Record<string, unknown>).priority;
			const result = RequirementSchema.safeParse(withoutPriority);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.priority).toBe("Medium");
			}
		});

		it("should default status to Proposed", () => {
			const withoutStatus = { ...validRequirement };
			delete (withoutStatus as Record<string, unknown>).status;
			const result = RequirementSchema.safeParse(withoutStatus);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.status).toBe("Proposed");
			}
		});

		it("should validate linkedIdeas as UUIDs", () => {
			const invalidIdeas = { ...validRequirement, linkedIdeas: ["not-a-uuid"] };
			const result = RequirementSchema.safeParse(invalidIdeas);
			expect(result.success).toBe(false);
		});

		it("should accept empty acceptanceCriteria array", () => {
			const emptyArray = { ...validRequirement, acceptanceCriteria: [] };
			const result = RequirementSchema.safeParse(emptyArray);
			expect(result.success).toBe(true);
		});
	});

	describe("RequirementFrontmatterSchema", () => {
		const validFrontmatter = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			priority: "High",
			status: "Proposed",
			solutionId: "660e8400-e29b-41d4-a716-446655440000",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid frontmatter", () => {
			const result = RequirementFrontmatterSchema.safeParse(validFrontmatter);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with acceptanceCriteria", () => {
			const withCriteria = {
				...validFrontmatter,
				acceptanceCriteria: ["Criterion 1", "Criterion 2"],
			};
			const result = RequirementFrontmatterSchema.safeParse(withCriteria);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with linkedIdeas", () => {
			const withIdeas = {
				...validFrontmatter,
				linkedIdeas: ["770e8400-e29b-41d4-a716-446655440000"],
			};
			const result = RequirementFrontmatterSchema.safeParse(withIdeas);
			expect(result.success).toBe(true);
		});

		it("should reject frontmatter without required fields", () => {
			const withoutId = { ...validFrontmatter };
			delete (withoutId as Record<string, unknown>).id;
			const result = RequirementFrontmatterSchema.safeParse(withoutId);
			expect(result.success).toBe(false);
		});
	});

	describe("Helper Functions", () => {
		describe("getRequirementStatusLabel", () => {
			it("should return correct labels", () => {
				expect(getRequirementStatusLabel("Proposed")).toBe("Proposed");
				expect(getRequirementStatusLabel("Approved")).toBe("Approved");
				expect(getRequirementStatusLabel("Satisfied")).toBe("Satisfied");
				expect(getRequirementStatusLabel("Obsolete")).toBe("Obsolete");
			});
		});

		describe("getRequirementStatusIcon", () => {
			it("should return correct icons", () => {
				expect(getRequirementStatusIcon("Proposed")).toBe("file-question");
				expect(getRequirementStatusIcon("Approved")).toBe("badge-check");
				expect(getRequirementStatusIcon("Satisfied")).toBe("check-circle-2");
				expect(getRequirementStatusIcon("Obsolete")).toBe("x-circle");
			});
		});

		describe("getPriorityLabel", () => {
			it("should return correct labels", () => {
				expect(getPriorityLabel("High")).toBe("High Priority");
				expect(getPriorityLabel("Medium")).toBe("Medium Priority");
				expect(getPriorityLabel("Low")).toBe("Low Priority");
			});
		});

		describe("getPriorityIcon", () => {
			it("should return correct icons", () => {
				expect(getPriorityIcon("High")).toBe("alert-triangle");
				expect(getPriorityIcon("Medium")).toBe("minus");
				expect(getPriorityIcon("Low")).toBe("arrow-down");
			});
		});
	});
});
