import { z } from 'zod';
import {
	SIGNIFICANCE_RANGE,
	USE_BONUS_RANGE,
	LLM_TEMPERATURE_RANGE,
	GOAL_TYPES,
	GOAL_PRIORITIES,
	MEMORY_OUTCOMES,
} from './ranges.js';

export const PositionSchema = z.object({
	x: z.number(),
	y: z.number(),
	region: z.string().optional(),
});

export const MemoryEntrySchema = z.object({
	tick: z.number(),
	type: z.string(),
	description: z.string(),
	participants: z.array(z.string()).default([]),
	outcome: z.enum(MEMORY_OUTCOMES),
	significance: z.number().min(SIGNIFICANCE_RANGE.min).max(SIGNIFICANCE_RANGE.max),
	mood_impact: z.number(),
	/** Persisted so decay formula can reference it after significance degrades (GDD §4.6) */
	original_significance: z.number().min(SIGNIFICANCE_RANGE.min).max(SIGNIFICANCE_RANGE.max).optional(),
});

export const GoalSchema = z.object({
	id: z.string(),
	type: z.enum(GOAL_TYPES),
	metric: z.string(),
	target: z.number(),
	priority: z.enum(GOAL_PRIORITIES),
	reward_xp: z.number().min(0),
	progress: z.number().min(0).default(0),
});

/** Agent's per-skill progress record (not the skill catalog definition in config/skills/) */
export const SkillEntrySchema = z.object({
	id: z.string(),
	points: z.number().int().min(0).default(0),
	use_count: z.number().int().min(0).default(0),
	use_bonus: z.number().int().min(USE_BONUS_RANGE.min).max(USE_BONUS_RANGE.max).default(0),
});

export const InventoryItemSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int().min(1),
	spoilage_remaining: z.number().nullable().default(null),
	charges: z.number().optional(),
});

export const EquipmentSchema = z.object({
	head: z.string().nullable().default(null),
	body: z.string().nullable().default(null),
	hands: z.string().nullable().default(null),
	tool: z.string().nullable().default(null),
	accessory: z.string().nullable().default(null),
});

export const LLMConfigSchema = z.object({
	enabled: z.boolean().default(false),
	provider: z.string().default('cursor'),
	personality: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
	temperature: z.number().min(LLM_TEMPERATURE_RANGE.min).max(LLM_TEMPERATURE_RANGE.max).default(0.7),
	max_tokens: z.number().int().min(1).default(150),
});
