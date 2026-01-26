import { describe, it, expect } from "vitest";
import {
	LIFECYCLE_PHASES,
	LifecyclePhaseSchema,
	SOLUTION_TYPES,
	SolutionFrontmatterSchema,
	SolutionSchema,
	SolutionTypeSchema,
	getSolutionTypeIcon,
	getSolutionTypeLabel,
} from "../../src/solutions/types";

describe("Solution Types", () => {
	describe("SOLUTION_TYPES", () => {
		it("should have 9 solution types", () => {
			expect(SOLUTION_TYPES).toHaveLength(9);
		});

		it("should include all expected types", () => {
			expect(SOLUTION_TYPES).toContain("Application");
			expect(SOLUTION_TYPES).toContain("Process");
			expect(SOLUTION_TYPES).toContain("Service");
			expect(SOLUTION_TYPES).toContain("Product");
			expect(SOLUTION_TYPES).toContain("Capability");
			expect(SOLUTION_TYPES).toContain("Data");
			expect(SOLUTION_TYPES).toContain("Tool");
			expect(SOLUTION_TYPES).toContain("Organization");
			expect(SOLUTION_TYPES).toContain("Policy");
		});
	});

	describe("LIFECYCLE_PHASES", () => {
		it("should have 9 lifecycle phases", () => {
			expect(LIFECYCLE_PHASES).toHaveLength(9);
		});

		it("should include all expected phases in correct order", () => {
			expect(LIFECYCLE_PHASES[0]).toBe("Ideate");
			expect(LIFECYCLE_PHASES[1]).toBe("Design");
			expect(LIFECYCLE_PHASES[2]).toBe("Validate");
			expect(LIFECYCLE_PHASES[3]).toBe("Develop");
			expect(LIFECYCLE_PHASES[4]).toBe("Test");
			expect(LIFECYCLE_PHASES[5]).toBe("Release");
			expect(LIFECYCLE_PHASES[6]).toBe("Run");
			expect(LIFECYCLE_PHASES[7]).toBe("Measure");
			expect(LIFECYCLE_PHASES[8]).toBe("Learn");
		});
	});

	describe("SolutionTypeSchema", () => {
		it("should accept valid solution types", () => {
			for (const type of SOLUTION_TYPES) {
				expect(SolutionTypeSchema.safeParse(type).success).toBe(true);
			}
		});

		it("should reject invalid solution types", () => {
			expect(SolutionTypeSchema.safeParse("Invalid").success).toBe(false);
			expect(SolutionTypeSchema.safeParse("").success).toBe(false);
			expect(SolutionTypeSchema.safeParse(123).success).toBe(false);
		});
	});

	describe("LifecyclePhaseSchema", () => {
		it("should accept valid lifecycle phases", () => {
			for (const phase of LIFECYCLE_PHASES) {
				expect(LifecyclePhaseSchema.safeParse(phase).success).toBe(true);
			}
		});

		it("should reject invalid lifecycle phases", () => {
			expect(LifecyclePhaseSchema.safeParse("Invalid").success).toBe(false);
			expect(LifecyclePhaseSchema.safeParse("").success).toBe(false);
		});
	});

	describe("SolutionSchema", () => {
		const validSolution = {
			id: "12345678-1234-4123-8123-123456789abc",
			name: "Test Solution",
			type: "Application",
			currentPhase: "Ideate",
			createdAt: "2026-01-25T10:00:00.000Z",
			updatedAt: "2026-01-25T10:00:00.000Z",
		};

		it("should accept valid solution", () => {
			const result = SolutionSchema.safeParse(validSolution);
			expect(result.success).toBe(true);
		});

		it("should accept solution with optional description", () => {
			const result = SolutionSchema.safeParse({
				...validSolution,
				description: "A test solution description",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.description).toBe("A test solution description");
			}
		});

		it("should default currentPhase to Ideate", () => {
			const solutionWithoutPhase = {
				id: "12345678-1234-4123-8123-123456789abc",
				name: "Test Solution",
				type: "Application",
				createdAt: "2026-01-25T10:00:00.000Z",
				updatedAt: "2026-01-25T10:00:00.000Z",
			};
			const result = SolutionSchema.safeParse(solutionWithoutPhase);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.currentPhase).toBe("Ideate");
			}
		});

		it("should reject empty name", () => {
			const result = SolutionSchema.safeParse({
				...validSolution,
				name: "",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid UUID", () => {
			const result = SolutionSchema.safeParse({
				...validSolution,
				id: "not-a-valid-uuid",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid solution type", () => {
			const result = SolutionSchema.safeParse({
				...validSolution,
				type: "InvalidType",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid lifecycle phase", () => {
			const result = SolutionSchema.safeParse({
				...validSolution,
				currentPhase: "InvalidPhase",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid date format", () => {
			const result = SolutionSchema.safeParse({
				...validSolution,
				createdAt: "not-a-date",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("SolutionFrontmatterSchema", () => {
		const validFrontmatter = {
			id: "12345678-1234-4123-8123-123456789abc",
			type: "Application",
			currentPhase: "Ideate",
			createdAt: "2026-01-25T10:00:00.000Z",
			updatedAt: "2026-01-25T10:00:00.000Z",
		};

		it("should accept valid frontmatter", () => {
			const result = SolutionFrontmatterSchema.safeParse(validFrontmatter);
			expect(result.success).toBe(true);
		});

		it("should reject missing required fields", () => {
			expect(
				SolutionFrontmatterSchema.safeParse({ id: "123" }).success
			).toBe(false);
		});
	});

	describe("getSolutionTypeLabel", () => {
		it("should return correct labels for all types", () => {
			expect(getSolutionTypeLabel("Application")).toBe("Application (Software)");
			expect(getSolutionTypeLabel("Process")).toBe("Process");
			expect(getSolutionTypeLabel("Service")).toBe("Service");
			expect(getSolutionTypeLabel("Product")).toBe("Product");
			expect(getSolutionTypeLabel("Capability")).toBe("Capability");
			expect(getSolutionTypeLabel("Data")).toBe("Data / Information");
			expect(getSolutionTypeLabel("Tool")).toBe("Tool / System");
			expect(getSolutionTypeLabel("Organization")).toBe("Organization / Team");
			expect(getSolutionTypeLabel("Policy")).toBe("Policy / Standard");
		});
	});

	describe("getSolutionTypeIcon", () => {
		it("should return correct icons for all types", () => {
			expect(getSolutionTypeIcon("Application")).toBe("code");
			expect(getSolutionTypeIcon("Process")).toBe("git-branch");
			expect(getSolutionTypeIcon("Service")).toBe("headphones");
			expect(getSolutionTypeIcon("Product")).toBe("package");
			expect(getSolutionTypeIcon("Capability")).toBe("brain");
			expect(getSolutionTypeIcon("Data")).toBe("database");
			expect(getSolutionTypeIcon("Tool")).toBe("wrench");
			expect(getSolutionTypeIcon("Organization")).toBe("users");
			expect(getSolutionTypeIcon("Policy")).toBe("file-text");
		});
	});
});
