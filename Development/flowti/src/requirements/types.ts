/**
 * Requirement types and interfaces for Flowti.
 *
 * Requirements are conditions or capabilities that a system must fulfill (IREB).
 * They are verifiable, prioritized, and traceable to ideas and solutions.
 */

import { z } from "zod";
import type { App } from "obsidian";
import type { UUID } from "../utils/types";
import type { IEventBus } from "../events/types";
import { UUIDSchema } from "../solutions/types";

// ─────────────────────────────────────────────────────────────────────────────
// Priority
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available priority levels.
 * Aligned with Data Dictionary TERM-044.
 */
export const PRIORITIES = ["High", "Medium", "Low"] as const;

/**
 * Priority as TypeScript type.
 */
export type PriorityName = (typeof PRIORITIES)[number];

/**
 * Zod schema for priority validation.
 */
export const PrioritySchema = z.enum(PRIORITIES);

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available requirement statuses.
 * Aligned with Data Dictionary TERM-043 and IREB lifecycle.
 */
export const REQUIREMENT_STATUSES = [
	"Proposed",
	"Approved",
	"Satisfied",
	"Obsolete",
] as const;

/**
 * Requirement status as TypeScript type.
 */
export type RequirementStatusName = (typeof REQUIREMENT_STATUSES)[number];

/**
 * Zod schema for requirement status validation.
 */
export const RequirementStatusSchema = z.enum(REQUIREMENT_STATUSES);

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for Requirement validation.
 * IREB-conformant requirement structure.
 */
export const RequirementSchema = z.object({
	/** Unique identifier (UUID v4) */
	id: UUIDSchema,

	/** Human-readable title */
	title: z.string().min(1, "Requirement title is required"),

	/** Detailed description (IREB: clear, unambiguous, verifiable) */
	description: z.string().optional(),

	/** Priority level */
	priority: PrioritySchema.default("Medium"),

	/** Current status in requirement lifecycle */
	status: RequirementStatusSchema.default("Proposed"),

	/** Reference to parent solution */
	solutionId: UUIDSchema,

	/** Acceptance criteria (how to verify the requirement is satisfied) */
	acceptanceCriteria: z.array(z.string()).optional(),

	/** Links to related ideas (for traceability) */
	linkedIdeas: z.array(UUIDSchema).optional(),

	/** ISO 8601 timestamp when created */
	createdAt: z.string().datetime(),

	/** ISO 8601 timestamp when last updated */
	updatedAt: z.string().datetime(),
});

/**
 * Requirement entity type inferred from schema.
 */
export type Requirement = z.infer<typeof RequirementSchema>;

/**
 * Input type for creating a new requirement (without generated fields).
 */
export interface CreateRequirementInput {
	title: string;
	description?: string;
	priority?: PriorityName;
	solutionId: UUID;
	acceptanceCriteria?: string[];
	linkedIdeas?: UUID[];
}

/**
 * Input type for updating a requirement.
 */
export interface UpdateRequirementInput {
	title?: string;
	description?: string;
	priority?: PriorityName;
	status?: RequirementStatusName;
	acceptanceCriteria?: string[];
	linkedIdeas?: UUID[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for RequirementService constructor.
 */
export interface RequirementServiceOptions {
	app: App;
	eventBus?: IEventBus;
	solutionsFolder?: string;
}

/**
 * Interface for requirement management operations.
 */
export interface IRequirementService {
	/**
	 * Create a new requirement within a solution.
	 */
	create(input: CreateRequirementInput): Promise<Requirement>;

	/**
	 * Load a requirement by its UUID.
	 */
	load(id: string): Promise<Requirement | null>;

	/**
	 * List all requirements for a specific solution.
	 */
	listBySolution(solutionId: string): Promise<Requirement[]>;

	/**
	 * List all requirements across all solutions.
	 */
	listAll(): Promise<Requirement[]>;

	/**
	 * Update a requirement.
	 */
	update(id: string, updates: UpdateRequirementInput): Promise<Requirement>;

	/**
	 * Delete a requirement.
	 */
	delete(id: string): Promise<void>;

	/**
	 * Get requirements linked to a specific idea.
	 * Useful for traceability queries.
	 */
	getByLinkedIdea(ideaId: string): Promise<Requirement[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for requirement frontmatter in markdown files.
 */
export const RequirementFrontmatterSchema = z.object({
	id: UUIDSchema,
	priority: PrioritySchema,
	status: RequirementStatusSchema,
	solutionId: UUIDSchema,
	acceptanceCriteria: z.array(z.string()).optional(),
	linkedIdeas: z.array(UUIDSchema).optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Frontmatter type for requirement markdown files.
 */
export type RequirementFrontmatter = z.infer<typeof RequirementFrontmatterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display label for a requirement status.
 */
export function getRequirementStatusLabel(status: RequirementStatusName): string {
	const labels: Record<RequirementStatusName, string> = {
		Proposed: "Proposed",
		Approved: "Approved",
		Satisfied: "Satisfied",
		Obsolete: "Obsolete",
	};
	return labels[status];
}

/**
 * Get the icon for a requirement status.
 */
export function getRequirementStatusIcon(status: RequirementStatusName): string {
	const icons: Record<RequirementStatusName, string> = {
		Proposed: "file-question",
		Approved: "badge-check",
		Satisfied: "check-circle-2",
		Obsolete: "x-circle",
	};
	return icons[status];
}

/**
 * Get the display label for a priority.
 */
export function getPriorityLabel(priority: PriorityName): string {
	const labels: Record<PriorityName, string> = {
		High: "High Priority",
		Medium: "Medium Priority",
		Low: "Low Priority",
	};
	return labels[priority];
}

/**
 * Get the icon for a priority.
 */
export function getPriorityIcon(priority: PriorityName): string {
	const icons: Record<PriorityName, string> = {
		High: "alert-triangle",
		Medium: "minus",
		Low: "arrow-down",
	};
	return icons[priority];
}
