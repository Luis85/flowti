/**
 * talk-types.ts — Type definitions for the template-driven talk engine.
 *
 * Defines the shape of template sets, weighted templates, and the
 * variable context used for interpolation.
 */

/** Kind of speech bubble displayed above an agent. */
export type BubbleKind = "speech" | "thought" | "question";

/** Category of a chatter line — determines selection weighting logic. */
export type TemplateCategory = "thinking" | "waiting" | "social" | "personality" | "filler";

/** A single template string with selection weight and category tag. */
export interface WeightedTemplate {
	readonly template: string;
	readonly weight: number;
	readonly category: TemplateCategory;
}

/** A named collection of categorized templates for a specific domain. */
export interface TemplateSet {
	readonly domain: string;
	readonly categories: Record<string, WeightedTemplate[]>;
}

/** Variables available for interpolation in template strings. */
export interface TemplateVars {
	readonly task: string;
	readonly mood_adj: string;
	readonly role: string;
	readonly domain: string;
	readonly idle_action: string;
	readonly nearby_agent: string;
	readonly nearby_domain: string;
	readonly persona_quirk: string;
	readonly phase: string;
	readonly weather: string;
	readonly streak: string;
	readonly friend_name: string;
	readonly mood: string;
	// Pet-specific fields (empty string for non-pet entries)
	readonly pet_name: string;
	readonly pet_type: string;
	readonly owner_name: string;
	readonly nearby_agent_mood: string;
	readonly hunger_level: string;
	readonly affection_level: string;
}

/** Pet voice mode — determines inner monologue tone. */
export type PetVoice = "instinct" | "eloquent" | "gremlin";
