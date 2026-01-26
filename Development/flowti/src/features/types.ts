/**
 * Feature types and interfaces for Flowti.
 *
 * Features are concrete product capabilities (e.g., "Dark Mode", "Export Function").
 * They bridge Ideas (solution concepts) and Requirements (technical specifications).
 * Each feature is linked to a parent solution and can trace to both ideas and requirements.
 */

import { z } from "zod";
import type { App } from "obsidian";
import type { UUID } from "../utils/types";
import type { IEventBus } from "../events/types";
import { UUIDSchema } from "../solutions/types";
import { PrioritySchema, type PriorityName } from "../requirements/types";

// ─────────────────────────────────────────────────────────────────────────────
// Feature Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available feature statuses.
 *
 * Lifecycle:
 * - Draft: Feature defined but not yet active
 * - Active: Feature is being developed
 * - Implemented: Feature is complete and deployed
 * - Deprecated: Feature is no longer supported
 */
export const FEATURE_STATUSES = [
	"Draft",
	"Active",
	"Implemented",
	"Deprecated",
] as const;

/**
 * Feature status as TypeScript type.
 */
export type FeatureStatusName = (typeof FEATURE_STATUSES)[number];

/**
 * Zod schema for feature status validation.
 */
export const FeatureStatusSchema = z.enum(FEATURE_STATUSES);

// ─────────────────────────────────────────────────────────────────────────────
// Feature Entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for Feature validation.
 */
export const FeatureSchema = z.object({
	/** Unique identifier (UUID v4) */
	id: UUIDSchema,

	/** Human-readable title (e.g., "Dark Mode", "Multi-language Support") */
	title: z.string().min(1, "Feature title is required"),

	/** Detailed description of the feature */
	description: z.string().optional(),

	/** Current status in feature lifecycle */
	status: FeatureStatusSchema.default("Draft"),

	/** Reference to parent solution */
	solutionId: UUIDSchema,

	/** Priority level (optional) */
	priority: PrioritySchema.optional(),

	/** Links to related ideas (traceability: what inspired this feature) */
	linkedIdeas: z.array(UUIDSchema).optional(),

	/** Links to related requirements (traceability: what this feature needs) */
	linkedRequirements: z.array(UUIDSchema).optional(),

	/** ISO 8601 timestamp when created */
	createdAt: z.string().datetime(),

	/** ISO 8601 timestamp when last updated */
	updatedAt: z.string().datetime(),
});

/**
 * Feature entity type inferred from schema.
 */
export type Feature = z.infer<typeof FeatureSchema>;

/**
 * Input type for creating a new feature (without generated fields).
 */
export interface CreateFeatureInput {
	title: string;
	description?: string;
	solutionId: UUID;
	priority?: PriorityName;
	linkedIdeas?: UUID[];
	linkedRequirements?: UUID[];
}

/**
 * Input type for updating a feature.
 */
export interface UpdateFeatureInput {
	title?: string;
	description?: string;
	status?: FeatureStatusName;
	priority?: PriorityName;
	linkedIdeas?: UUID[];
	linkedRequirements?: UUID[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for FeatureService constructor.
 */
export interface FeatureServiceOptions {
	app: App;
	eventBus?: IEventBus;
	solutionsFolder?: string;
}

/**
 * Interface for feature management operations.
 */
export interface IFeatureService {
	/**
	 * Create a new feature within a solution.
	 */
	create(input: CreateFeatureInput): Promise<Feature>;

	/**
	 * Load a feature by its UUID.
	 */
	load(id: string): Promise<Feature | null>;

	/**
	 * List all features for a specific solution.
	 */
	listBySolution(solutionId: string): Promise<Feature[]>;

	/**
	 * List all features across all solutions.
	 */
	listAll(): Promise<Feature[]>;

	/**
	 * Update a feature.
	 */
	update(id: string, updates: UpdateFeatureInput): Promise<Feature>;

	/**
	 * Delete a feature.
	 */
	delete(id: string): Promise<void>;

	/**
	 * Get features linked to a specific idea.
	 * Useful for traceability queries.
	 */
	getByLinkedIdea(ideaId: string): Promise<Feature[]>;

	/**
	 * Get features linked to a specific requirement.
	 * Useful for traceability queries.
	 */
	getByLinkedRequirement(requirementId: string): Promise<Feature[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for feature frontmatter in markdown files.
 */
export const FeatureFrontmatterSchema = z.object({
	id: UUIDSchema,
	status: FeatureStatusSchema,
	solutionId: UUIDSchema,
	priority: PrioritySchema.optional(),
	linkedIdeas: z.array(UUIDSchema).optional(),
	linkedRequirements: z.array(UUIDSchema).optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Frontmatter type for feature markdown files.
 */
export type FeatureFrontmatter = z.infer<typeof FeatureFrontmatterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display label for a feature status.
 */
export function getFeatureStatusLabel(status: FeatureStatusName): string {
	const labels: Record<FeatureStatusName, string> = {
		Draft: "Draft",
		Active: "Active",
		Implemented: "Implemented",
		Deprecated: "Deprecated",
	};
	return labels[status];
}

/**
 * Get the icon for a feature status.
 */
export function getFeatureStatusIcon(status: FeatureStatusName): string {
	const icons: Record<FeatureStatusName, string> = {
		Draft: "file-edit",
		Active: "play-circle",
		Implemented: "check-circle",
		Deprecated: "archive",
	};
	return icons[status];
}

/**
 * Get badge variant class for a feature status.
 */
export function getFeatureStatusVariant(status: FeatureStatusName): string {
	const variants: Record<FeatureStatusName, string> = {
		Draft: "ft-badge-muted",
		Active: "ft-badge-accent",
		Implemented: "ft-badge-success",
		Deprecated: "ft-badge-warning",
	};
	return variants[status];
}
