/**
 * Zod schemas for Feature Lifecycle frontmatter validation.
 *
 * Used to parse PRD frontmatter into typed structures with
 * lenient validation (coerce, default, optional) to handle
 * the diversity of existing PRD formats across 41+ files.
 */

import { z } from "zod";

/** Coerce a value to number or return null. */
const scoreField = z.preprocess(
	(v) => (v === null || v === undefined || v === "" ? null : Number(v)),
	z.number().min(0).max(5).nullable().default(null),
);

/** PRD frontmatter schema — lenient parsing for diverse formats. */
export const PRDFrontmatterSchema = z.object({
	type: z.string().default("unknown"),
	stage: z.string().default("idea"),
	domain: z.string().default("unknown"),
	maturity: z.string().nullable().default(null),
	related_events: z.array(z.string()).default([]),

	// FRI dimensions (maturity_score_*)
	maturity_score_strategy: scoreField,
	maturity_score_scope: scoreField,
	maturity_score_architecture: scoreField,
	maturity_score_event_integration: scoreField,
	maturity_score_data_model: scoreField,
	maturity_score_ui_consistency: scoreField,
	maturity_score_validation_testing: scoreField,

	// Prioritization dimensions
	business_value: scoreField,
	implementation_cost: scoreField,
	maintenance_cost: scoreField,
	discovery_cost: scoreField,
	design_cost: scoreField,
	test_cost: scoreField,
	priority: scoreField,
}).passthrough();

export type PRDFrontmatter = z.infer<typeof PRDFrontmatterSchema>;
