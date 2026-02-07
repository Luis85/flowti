/**
 * Idea types and interfaces for Flowti.
 *
 * Ideas are preliminary thoughts or concepts that may become requirements.
 * Each idea is linked to a parent solution and tracked through its lifecycle.
 */

import { z } from "zod";
import type { App } from "obsidian";
import type { UUID } from "../utils/types";
import type { IEventBus } from "../events/types";
import type { LifecyclePhaseName } from "../solutions/types";
import { UUIDSchema, LifecyclePhaseSchema } from "../solutions/types";

// ─────────────────────────────────────────────────────────────────────────────
// Idea Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available idea statuses.
 * Aligned with Data Dictionary TERM-042.
 */
export const IDEA_STATUSES = ["Active", "Archived", "Implemented"] as const;

/**
 * Idea status as TypeScript type.
 */
export type IdeaStatusName = (typeof IDEA_STATUSES)[number];

/**
 * Zod schema for idea status validation.
 */
export const IdeaStatusSchema = z.enum(IDEA_STATUSES);

// ─────────────────────────────────────────────────────────────────────────────
// Idea Entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for Idea validation.
 */
export const IdeaSchema = z.object({
	/** Unique identifier (UUID v4) */
	id: UUIDSchema,

	/** Human-readable title */
	title: z.string().min(1, "Idea title is required"),

	/** Detailed description */
	description: z.string().optional(),

	/** Current status */
	status: IdeaStatusSchema.default("Active"),

	/** Reference to parent solution */
	solutionId: UUIDSchema,

	/** Lifecycle phase when idea was created (optional) */
	sourcePhase: LifecyclePhaseSchema.optional(),

	/** ISO 8601 timestamp when created */
	createdAt: z.string().datetime(),

	/** ISO 8601 timestamp when last updated */
	updatedAt: z.string().datetime(),
});

/**
 * Idea entity type inferred from schema.
 */
export type Idea = z.infer<typeof IdeaSchema>;

/**
 * Input type for creating a new idea (without generated fields).
 */
export interface CreateIdeaInput {
	title: string;
	description?: string;
	solutionId: UUID;
	sourcePhase?: LifecyclePhaseName;
}

/**
 * Input type for updating an idea.
 */
export interface UpdateIdeaInput {
	title?: string;
	description?: string;
	status?: IdeaStatusName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Idea Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for IdeaService constructor.
 */
export interface IdeaServiceOptions {
	app: App;
	eventBus?: IEventBus;
	solutionsFolder?: string;
}

/**
 * Interface for idea management operations.
 */
export interface IIdeaService {
	/**
	 * Create a new idea within a solution.
	 */
	create(input: CreateIdeaInput): Promise<Idea>;

	/**
	 * Load an idea by its UUID.
	 */
	load(id: string): Promise<Idea | null>;

	/**
	 * List all ideas for a specific solution.
	 */
	listBySolution(solutionId: string): Promise<Idea[]>;

	/**
	 * List all ideas across all solutions.
	 */
	listAll(): Promise<Idea[]>;

	/**
	 * Update an idea.
	 */
	update(id: string, updates: UpdateIdeaInput): Promise<Idea>;

	/**
	 * Delete an idea.
	 */
	delete(id: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for idea frontmatter in markdown files.
 */
export const IdeaFrontmatterSchema = z.object({
	id: UUIDSchema,
	status: IdeaStatusSchema,
	solutionId: UUIDSchema,
	sourcePhase: LifecyclePhaseSchema.optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Frontmatter type for idea markdown files.
 */
export type IdeaFrontmatter = z.infer<typeof IdeaFrontmatterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display label for an idea status.
 */
export function getIdeaStatusLabel(status: IdeaStatusName): string {
	const labels: Record<IdeaStatusName, string> = {
		Active: "Active",
		Archived: "Archived",
		Implemented: "Implemented",
	};
	return labels[status];
}

/**
 * Get the icon for an idea status.
 */
export function getIdeaStatusIcon(status: IdeaStatusName): string {
	const icons: Record<IdeaStatusName, string> = {
		Active: "lightbulb",
		Archived: "archive",
		Implemented: "check-circle",
	};
	return icons[status];
}
