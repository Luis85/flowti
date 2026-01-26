import { describe, it, expect } from "vitest";
import {
	FeatureSchema,
	FeatureStatusSchema,
	FeatureFrontmatterSchema,
	FEATURE_STATUSES,
	getFeatureStatusLabel,
	getFeatureStatusIcon,
	getFeatureStatusVariant,
} from "../../src/features/types";
import type { UUID } from "../../src/utils/types";

describe("Feature Types", () => {
	describe("FEATURE_STATUSES", () => {
		it("should have exactly 4 statuses", () => {
			expect(FEATURE_STATUSES).toHaveLength(4);
		});

		it("should contain Draft, Active, Implemented, and Deprecated", () => {
			expect(FEATURE_STATUSES).toContain("Draft");
			expect(FEATURE_STATUSES).toContain("Active");
			expect(FEATURE_STATUSES).toContain("Implemented");
			expect(FEATURE_STATUSES).toContain("Deprecated");
		});
	});

	describe("FeatureStatusSchema", () => {
		it("should accept valid statuses", () => {
			expect(FeatureStatusSchema.parse("Draft")).toBe("Draft");
			expect(FeatureStatusSchema.parse("Active")).toBe("Active");
			expect(FeatureStatusSchema.parse("Implemented")).toBe("Implemented");
			expect(FeatureStatusSchema.parse("Deprecated")).toBe("Deprecated");
		});

		it("should reject invalid statuses", () => {
			expect(() => FeatureStatusSchema.parse("Invalid")).toThrow();
			expect(() => FeatureStatusSchema.parse("")).toThrow();
		});
	});

	describe("FeatureSchema", () => {
		const validFeature = {
			id: "550e8400-e29b-41d4-a716-446655440000" as UUID,
			title: "Dark Mode",
			description: "Enable dark theme for the application",
			status: "Active",
			solutionId: "660e8400-e29b-41d4-a716-446655440000" as UUID,
			priority: "High",
			linkedIdeas: ["770e8400-e29b-41d4-a716-446655440000" as UUID],
			linkedRequirements: ["880e8400-e29b-41d4-a716-446655440000" as UUID],
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid feature data", () => {
			const result = FeatureSchema.safeParse(validFeature);
			expect(result.success).toBe(true);
		});

		it("should require title", () => {
			const invalid = { ...validFeature, title: "" };
			const result = FeatureSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for id", () => {
			const invalid = { ...validFeature, id: "not-a-uuid" };
			const result = FeatureSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should require valid UUID for solutionId", () => {
			const invalid = { ...validFeature, solutionId: "not-a-uuid" };
			const result = FeatureSchema.safeParse(invalid);
			expect(result.success).toBe(false);
		});

		it("should accept optional description", () => {
			const withoutDesc = { ...validFeature };
			delete (withoutDesc as Record<string, unknown>).description;
			const result = FeatureSchema.safeParse(withoutDesc);
			expect(result.success).toBe(true);
		});

		it("should accept optional priority", () => {
			const withoutPriority = { ...validFeature };
			delete (withoutPriority as Record<string, unknown>).priority;
			const result = FeatureSchema.safeParse(withoutPriority);
			expect(result.success).toBe(true);
		});

		it("should accept optional linkedIdeas", () => {
			const withoutLinkedIdeas = { ...validFeature };
			delete (withoutLinkedIdeas as Record<string, unknown>).linkedIdeas;
			const result = FeatureSchema.safeParse(withoutLinkedIdeas);
			expect(result.success).toBe(true);
		});

		it("should accept optional linkedRequirements", () => {
			const withoutLinkedReqs = { ...validFeature };
			delete (withoutLinkedReqs as Record<string, unknown>).linkedRequirements;
			const result = FeatureSchema.safeParse(withoutLinkedReqs);
			expect(result.success).toBe(true);
		});

		it("should default status to Draft", () => {
			const withoutStatus = { ...validFeature };
			delete (withoutStatus as Record<string, unknown>).status;
			const result = FeatureSchema.safeParse(withoutStatus);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.status).toBe("Draft");
			}
		});

		it("should validate priority against valid values", () => {
			const invalidPriority = { ...validFeature, priority: "InvalidPriority" };
			const result = FeatureSchema.safeParse(invalidPriority);
			expect(result.success).toBe(false);
		});

		it("should validate linkedIdeas contains valid UUIDs", () => {
			const invalidLinkedIdeas = { ...validFeature, linkedIdeas: ["not-a-uuid"] };
			const result = FeatureSchema.safeParse(invalidLinkedIdeas);
			expect(result.success).toBe(false);
		});

		it("should validate linkedRequirements contains valid UUIDs", () => {
			const invalidLinkedReqs = { ...validFeature, linkedRequirements: ["not-a-uuid"] };
			const result = FeatureSchema.safeParse(invalidLinkedReqs);
			expect(result.success).toBe(false);
		});
	});

	describe("FeatureFrontmatterSchema", () => {
		const validFrontmatter = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			status: "Active",
			solutionId: "660e8400-e29b-41d4-a716-446655440000",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};

		it("should accept valid frontmatter", () => {
			const result = FeatureFrontmatterSchema.safeParse(validFrontmatter);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with optional priority", () => {
			const withPriority = { ...validFrontmatter, priority: "Medium" };
			const result = FeatureFrontmatterSchema.safeParse(withPriority);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with optional linkedIdeas", () => {
			const withLinkedIdeas = {
				...validFrontmatter,
				linkedIdeas: ["770e8400-e29b-41d4-a716-446655440000"],
			};
			const result = FeatureFrontmatterSchema.safeParse(withLinkedIdeas);
			expect(result.success).toBe(true);
		});

		it("should accept frontmatter with optional linkedRequirements", () => {
			const withLinkedReqs = {
				...validFrontmatter,
				linkedRequirements: ["880e8400-e29b-41d4-a716-446655440000"],
			};
			const result = FeatureFrontmatterSchema.safeParse(withLinkedReqs);
			expect(result.success).toBe(true);
		});

		it("should reject frontmatter without required fields", () => {
			const withoutId = { ...validFrontmatter };
			delete (withoutId as Record<string, unknown>).id;
			const result = FeatureFrontmatterSchema.safeParse(withoutId);
			expect(result.success).toBe(false);
		});
	});

	describe("Helper Functions", () => {
		describe("getFeatureStatusLabel", () => {
			it("should return correct labels", () => {
				expect(getFeatureStatusLabel("Draft")).toBe("Draft");
				expect(getFeatureStatusLabel("Active")).toBe("Active");
				expect(getFeatureStatusLabel("Implemented")).toBe("Implemented");
				expect(getFeatureStatusLabel("Deprecated")).toBe("Deprecated");
			});
		});

		describe("getFeatureStatusIcon", () => {
			it("should return correct icons", () => {
				expect(getFeatureStatusIcon("Draft")).toBe("file-edit");
				expect(getFeatureStatusIcon("Active")).toBe("play-circle");
				expect(getFeatureStatusIcon("Implemented")).toBe("check-circle");
				expect(getFeatureStatusIcon("Deprecated")).toBe("archive");
			});
		});

		describe("getFeatureStatusVariant", () => {
			it("should return correct badge variants", () => {
				expect(getFeatureStatusVariant("Draft")).toBe("ft-badge-muted");
				expect(getFeatureStatusVariant("Active")).toBe("ft-badge-accent");
				expect(getFeatureStatusVariant("Implemented")).toBe("ft-badge-success");
				expect(getFeatureStatusVariant("Deprecated")).toBe("ft-badge-warning");
			});
		});
	});
});
