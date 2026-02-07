/**
 * JTBD (Jobs to be Done) types and interfaces for Flowti.
 *
 * JTBD captures user needs in the format:
 * "When [situation], I want to [motivation], so I can [outcome]"
 *
 * Uses Anthony Ulwick's ODI (Outcome-Driven Innovation) methodology
 * with importance/satisfaction metrics to calculate opportunity scores.
 */

import { z } from "zod";
import type { App } from "obsidian";
import type { UUID } from "../utils/types";
import type { IEventBus } from "../events/types";
import { UUIDSchema } from "../solutions/types";

// ─────────────────────────────────────────────────────────────────────────────
// JTBD Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available JTBD statuses.
 * Aligned with Data Dictionary TERM-046.
 */
export const JTBD_STATUSES = ["Active", "Validated", "Archived"] as const;

/**
 * JTBD status as TypeScript type.
 */
export type JTBDStatusName = (typeof JTBD_STATUSES)[number];

/**
 * Zod schema for JTBD status validation.
 */
export const JTBDStatusSchema = z.enum(JTBD_STATUSES);

// ─────────────────────────────────────────────────────────────────────────────
// Importance & Satisfaction Scales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scale for importance and satisfaction (1-5).
 */
export const SCALE_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Scale value type.
 */
export type ScaleValue = (typeof SCALE_VALUES)[number];

/**
 * Zod schema for scale validation (1-5).
 */
export const ScaleSchema = z.number().int().min(1).max(5);

// ─────────────────────────────────────────────────────────────────────────────
// JTBD Entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for JTBD validation.
 */
export const JTBDSchema = z.object({
	/** Unique identifier (UUID v4) */
	id: UUIDSchema,

	/**
	 * The complete job statement.
	 * Format: "When [context], I want to [motivation], so I can [outcome]"
	 */
	jobStatement: z.string().min(1, "Job statement is required"),

	/** The "When" part - situation or trigger */
	context: z.string().optional(),

	/** The "I want to" part - action or desire */
	motivation: z.string().optional(),

	/** The "So I can" part - expected result */
	outcome: z.string().optional(),

	/**
	 * How important is this job to the user? (1-5)
	 * Higher = more important
	 */
	importance: ScaleSchema.default(3),

	/**
	 * How satisfied is the user with current solutions? (1-5)
	 * Higher = more satisfied
	 */
	satisfaction: ScaleSchema.default(3),

	/** Current status */
	status: JTBDStatusSchema.default("Active"),

	/** Reference to parent solution */
	solutionId: UUIDSchema,

	/** Requirements derived from this job */
	linkedRequirements: z.array(UUIDSchema).optional(),

	/** Ideas that address this job */
	linkedIdeas: z.array(UUIDSchema).optional(),

	/** ISO 8601 timestamp when created */
	createdAt: z.string().datetime(),

	/** ISO 8601 timestamp when last updated */
	updatedAt: z.string().datetime(),
});

/**
 * JTBD entity type inferred from schema.
 */
export type JTBD = z.infer<typeof JTBDSchema>;

/**
 * Input type for creating a new JTBD (without generated fields).
 */
export interface CreateJTBDInput {
	jobStatement: string;
	context?: string;
	motivation?: string;
	outcome?: string;
	importance?: ScaleValue;
	satisfaction?: ScaleValue;
	solutionId: UUID;
}

/**
 * Input type for updating a JTBD.
 */
export interface UpdateJTBDInput {
	jobStatement?: string;
	context?: string;
	motivation?: string;
	outcome?: string;
	importance?: ScaleValue;
	satisfaction?: ScaleValue;
	status?: JTBDStatusName;
	linkedRequirements?: UUID[];
	linkedIdeas?: UUID[];
}

// ─────────────────────────────────────────────────────────────────────────────
// JTBD Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for JTBDService constructor.
 */
export interface JTBDServiceOptions {
	app: App;
	eventBus?: IEventBus;
	solutionsFolder?: string;
}

/**
 * Interface for JTBD management operations.
 */
export interface IJTBDService {
	/**
	 * Create a new JTBD within a solution.
	 */
	create(input: CreateJTBDInput): Promise<JTBD>;

	/**
	 * Load a JTBD by its UUID.
	 */
	load(id: string): Promise<JTBD | null>;

	/**
	 * List all JTBDs for a specific solution.
	 */
	listBySolution(solutionId: string): Promise<JTBD[]>;

	/**
	 * List all JTBDs across all solutions.
	 */
	listAll(): Promise<JTBD[]>;

	/**
	 * Update a JTBD.
	 */
	update(id: string, updates: UpdateJTBDInput): Promise<JTBD>;

	/**
	 * Delete a JTBD.
	 */
	delete(id: string): Promise<void>;

	/**
	 * Get JTBDs linked to a specific idea.
	 */
	getByLinkedIdea(ideaId: string): Promise<JTBD[]>;

	/**
	 * Get JTBDs linked to a specific requirement.
	 */
	getByLinkedRequirement(requirementId: string): Promise<JTBD[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for JTBD frontmatter in markdown files.
 */
export const JTBDFrontmatterSchema = z.object({
	id: UUIDSchema,
	status: JTBDStatusSchema,
	solutionId: UUIDSchema,
	importance: ScaleSchema,
	satisfaction: ScaleSchema,
	linkedRequirements: z.array(z.string()).optional(),
	linkedIdeas: z.array(z.string()).optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Frontmatter type for JTBD markdown files.
 */
export type JTBDFrontmatter = z.infer<typeof JTBDFrontmatterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the opportunity score for a JTBD.
 *
 * Uses Anthony Ulwick's ODI formula:
 * Opportunity = Importance + max(Importance - Satisfaction, 0)
 *
 * @param importance - Importance score (1-5)
 * @param satisfaction - Satisfaction score (1-5)
 * @returns Opportunity score (1-10, higher = more opportunity)
 */
export function calculateOpportunityScore(
	importance: number,
	satisfaction: number
): number {
	return importance + Math.max(importance - satisfaction, 0);
}

/**
 * Get the opportunity level based on score.
 *
 * @param score - Opportunity score (1-10)
 * @returns "high" (7-10), "medium" (4-6), or "low" (1-3)
 */
export function getOpportunityLevel(
	score: number
): "high" | "medium" | "low" {
	if (score >= 7) return "high";
	if (score >= 4) return "medium";
	return "low";
}

/**
 * Get the display label for a JTBD status.
 */
export function getJTBDStatusLabel(status: JTBDStatusName): string {
	const labels: Record<JTBDStatusName, string> = {
		Active: "Active",
		Validated: "Validated",
		Archived: "Archived",
	};
	return labels[status];
}

/**
 * Get the icon for a JTBD status.
 */
export function getJTBDStatusIcon(status: JTBDStatusName): string {
	const icons: Record<JTBDStatusName, string> = {
		Active: "target",
		Validated: "check-circle-2",
		Archived: "archive",
	};
	return icons[status];
}

/**
 * Get the display label for a scale value.
 */
export function getScaleLabel(value: ScaleValue, type: "importance" | "satisfaction"): string {
	const importanceLabels: Record<ScaleValue, string> = {
		1: "Not Important",
		2: "Slightly Important",
		3: "Moderately Important",
		4: "Very Important",
		5: "Extremely Important",
	};

	const satisfactionLabels: Record<ScaleValue, string> = {
		1: "Very Dissatisfied",
		2: "Dissatisfied",
		3: "Neutral",
		4: "Satisfied",
		5: "Very Satisfied",
	};

	return type === "importance" ? importanceLabels[value] : satisfactionLabels[value];
}
