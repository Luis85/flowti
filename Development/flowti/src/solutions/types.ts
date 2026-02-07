import { z } from "zod";
import type { App } from "obsidian";
import type { UUID } from "../utils/types";
import type { IEventBus } from "../events/types";

// ─────────────────────────────────────────────────────────────────────────────
// UUID Schema (re-export for convenience)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UUID validation regex pattern for v4 UUIDs.
 */
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Zod schema for UUID validation.
 */
export const UUIDSchema = z
	.string()
	.regex(UUID_REGEX, "Invalid UUID format")
	.transform((val) => val as UUID);

// ─────────────────────────────────────────────────────────────────────────────
// Solution Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available solution types.
 * These align with the Data Dictionary definitions (TERM-020 to TERM-028).
 */
export const SOLUTION_TYPES = [
	"Application",
	"Process",
	"Service",
	"Product",
	"Capability",
	"Data",
	"Tool",
	"Organization",
	"Policy",
] as const;

/**
 * Solution type as TypeScript type.
 */
export type SolutionTypeName = (typeof SOLUTION_TYPES)[number];

/**
 * Zod schema for solution type validation.
 */
export const SolutionTypeSchema = z.enum(SOLUTION_TYPES);

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Phases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All lifecycle phases a solution goes through.
 * Aligned with Data Dictionary TERM-003.
 */
export const LIFECYCLE_PHASES = [
	"Ideate",
	"Design",
	"Validate",
	"Develop",
	"Test",
	"Release",
	"Run",
	"Measure",
	"Learn",
] as const;

/**
 * Lifecycle phase as TypeScript type.
 */
export type LifecyclePhaseName = (typeof LIFECYCLE_PHASES)[number];

/**
 * Zod schema for lifecycle phase validation.
 */
export const LifecyclePhaseSchema = z.enum(LIFECYCLE_PHASES);

// ─────────────────────────────────────────────────────────────────────────────
// Solution Entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for Solution validation.
 * This is the core entity of the Solution Builder.
 */
export const SolutionSchema = z.object({
	/** Unique identifier (UUID v4) */
	id: UUIDSchema,

	/** Human-readable name */
	name: z.string().min(1, "Solution name is required"),

	/** Type of solution (determines deliverables and phases) */
	type: SolutionTypeSchema,

	/** Optional description */
	description: z.string().optional(),

	/** Current lifecycle phase */
	currentPhase: LifecyclePhaseSchema.default("Ideate"),

	/** ISO 8601 timestamp when created */
	createdAt: z.string().datetime(),

	/** ISO 8601 timestamp when last updated */
	updatedAt: z.string().datetime(),
});

/**
 * Solution entity type inferred from schema.
 */
export type Solution = z.infer<typeof SolutionSchema>;

/**
 * Input type for creating a new solution (without generated fields).
 */
export interface CreateSolutionInput {
	name: string;
	type: SolutionTypeName;
	description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Solution Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for SolutionService constructor.
 */
export interface SolutionServiceOptions {
	app: App;
	eventBus?: IEventBus;
	solutionsFolder?: string;
}

/**
 * Interface for solution management operations.
 */
export interface ISolutionService {
	/**
	 * Create a new solution.
	 * Creates a markdown file in the solutions folder.
	 */
	create(input: CreateSolutionInput): Promise<Solution>;

	/**
	 * Load a solution by its UUID.
	 */
	load(id: string): Promise<Solution | null>;

	/**
	 * Get a solution by its name.
	 */
	getByName(name: string): Promise<Solution | null>;

	/**
	 * List all solutions.
	 */
	list(): Promise<Solution[]>;

	/**
	 * Update a solution.
	 */
	update(id: string, updates: Partial<CreateSolutionInput>): Promise<Solution>;

	/**
	 * Delete a solution.
	 */
	delete(id: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for solution frontmatter in markdown files.
 * This is a subset of Solution used for YAML serialization.
 */
export const SolutionFrontmatterSchema = z.object({
	id: UUIDSchema,
	type: SolutionTypeSchema,
	currentPhase: LifecyclePhaseSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Frontmatter type for markdown files.
 */
export type SolutionFrontmatter = z.infer<typeof SolutionFrontmatterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display label for a solution type.
 */
export function getSolutionTypeLabel(type: SolutionTypeName): string {
	const labels: Record<SolutionTypeName, string> = {
		Application: "Application (Software)",
		Process: "Process",
		Service: "Service",
		Product: "Product",
		Capability: "Capability",
		Data: "Data / Information",
		Tool: "Tool / System",
		Organization: "Organization / Team",
		Policy: "Policy / Standard",
	};
	return labels[type];
}

/**
 * Get the icon for a solution type.
 */
export function getSolutionTypeIcon(type: SolutionTypeName): string {
	const icons: Record<SolutionTypeName, string> = {
		Application: "code",
		Process: "git-branch",
		Service: "headphones",
		Product: "package",
		Capability: "brain",
		Data: "database",
		Tool: "wrench",
		Organization: "users",
		Policy: "file-text",
	};
	return icons[type];
}
