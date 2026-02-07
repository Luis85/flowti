import { describe, it, expect } from "vitest";
import {
	IdeaSchema,
	IdeaStatusSchema,
	IdeaFrontmatterSchema,
	IDEA_STATUSES,
	getIdeaStatusLabel,
	getIdeaStatusIcon,
} from "../../src/ideas/types";
import type { UUID } from "../../src/utils/types";

describe("Ideas Types", () => {
	describe("IDEA_STATUSES", () => {
		it("should have exactly 3 statuses", () => {
			expect(IDEA_STATUSES).toHaveLength(3);
		});

		it("should contain Active, Archived, and Implemented", () => {
			expect(IDEA_STATUSES).toContain("Active");
			expect(IDEA_STATUSES).toContain("Archived");
			expect(IDEA_STATUSES).toContain("Implemented");
		});
	});

	describe("IdeaStatusSchema", () => {
		it("should accept valid statuses", () => {
			expect(IdeaStatusSchema.parse("Active")).toBe("Active");
			expect(IdeaStatusSchema.parse("Archived")).toBe("Archived");
			expect(IdeaStatusSchema.parse("Implemented")).toBe("Implemented");
		});

		it("should reject invalid statuses", () => {
			expect(() => IdeaStatusSchema.parse("Invalid")).toThrow();
			expect(() => IdeaStatusSchema.parse("")).toThrow();
		});
	});

	describe("IdeaSchema", () => {
		const validIdea = {
			id: "550e8400-e29b-41d4-a716-446655440000" as UUID,
			title: "Test Idea",
			description: "A test description",
			status: "Active",
			solutionId: "660e8400-e29b-41d4-a716-446655440000" as UUID,
			sourcePhase: "Ideate",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid idea data", () => {
			const result = IdeaSchema.safeParse(validIdea);
			expect(result.success).toBe(true);
		});

		it("should require title", () => {
			const invalid = { ...validIdea, title: "" };
			const result = IdeaSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for id", () => {
			const invalid = { ...validIdea, id: "not-a-uuid" };
			const result = IdeaSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for solutionId", () => {
			const invalid = { ...validIdea, solutionId: "not-a-uuid" };
			const result = IdeaSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should accept optional description", () => {
			const withoutDesc = { ...validIdea };
			delete (withoutDesc as Record<string, unknown>).description;
			const result = IdeaSchema.safeParse(withoutDesc);
			expect(result.success).toBe(true);
		});

		it("should accept optional sourcePhase", () => {
			const withoutPhase = { ...validIdea };
			delete (withoutPhase as Record<string, unknown>).sourcePhase;
			const result = IdeaSchema.safeParse(withoutPhase);
			expect(result.success).toBe(true);
		});

		it("should default status to Active", () => {
			const withoutStatus = { ...validIdea };
			delete (withoutStatus as Record<string, unknown>).status;
			const result = IdeaSchema.safeParse(withoutStatus);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.status).toBe("Active");
			}
		});

		it("should validate sourcePhase against lifecycle phases", () => {
			const invalidPhase = { ...validIdea, sourcePhase: "InvalidPhase" };
			const result = IdeaSchema.safeParse(invalidPhase);
			expect(result.success).toBe(false);
		});
	});

	describe("IdeaFrontmatterSchema", () => {
		const validFrontmatter = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			status: "Active",
			solutionId: "660e8400-e29b-41d4-a716-446655440000",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid frontmatter", () => {
			const result = IdeaFrontmatterSchema.safeParse(validFrontmatter);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with optional sourcePhase", () => {
			const withPhase = { ...validFrontmatter, sourcePhase: "Design" };
			const result = IdeaFrontmatterSchema.safeParse(withPhase);
			expect(result.success).toBe(true);
		});

		it("should reject frontmatter without required fields", () => {
			const withoutId = { ...validFrontmatter };
			delete (withoutId as Record<string, unknown>).id;
			const result = IdeaFrontmatterSchema.safeParse(withoutId);
			expect(result.success).toBe(false);
		});
	});

	describe("Helper Functions", () => {
		describe("getIdeaStatusLabel", () => {
			it("should return correct labels", () => {
				expect(getIdeaStatusLabel("Active")).toBe("Active");
				expect(getIdeaStatusLabel("Archived")).toBe("Archived");
				expect(getIdeaStatusLabel("Implemented")).toBe("Implemented");
			});
		});

		describe("getIdeaStatusIcon", () => {
			it("should return correct icons", () => {
				expect(getIdeaStatusIcon("Active")).toBe("lightbulb");
				expect(getIdeaStatusIcon("Archived")).toBe("archive");
				expect(getIdeaStatusIcon("Implemented")).toBe("check-circle");
			});
		});
	});
});
