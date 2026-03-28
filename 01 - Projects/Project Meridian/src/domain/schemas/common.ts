import { z } from 'zod';

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
	outcome: z.enum(['positive', 'negative', 'neutral']),
	significance: z.number().min(1).max(10),
	mood_impact: z.number(),
	original_significance: z.number().min(1).max(10).optional(),
});

export const GoalSchema = z.object({
	id: z.string(),
	type: z.enum(['aspirational', 'operational']),
	metric: z.string(),
	target: z.number(),
	priority: z.enum(['high', 'medium', 'low']),
	reward_xp: z.number().min(0),
	progress: z.number().min(0).default(0),
});

export const SkillEntrySchema = z.object({
	id: z.string(),
	points: z.number().int().min(0).default(0),
	use_count: z.number().int().min(0).default(0),
	use_bonus: z.number().int().min(0).max(3).default(0),
});

export const InventoryItemSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int().min(1),
	spoilage_remaining: z.number().nullable().default(null),
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
	temperature: z.number().min(0).max(2).default(0.7),
	max_tokens: z.number().int().min(1).default(150),
});
