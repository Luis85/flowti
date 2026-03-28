import { z } from 'zod';
import {
	ATTRIBUTE_RANGE,
	STATUS_RANGE,
	REPUTATION_RANGE,
	CHARISMA_RANGE,
	NEED_RANGE,
	MOOD_RANGE,
	MOOD_DEFAULT,
} from './ranges.js';
import {
	PositionSchema,
	MemoryEntrySchema,
	GoalSchema,
	SkillEntrySchema,
	InventoryItemSchema,
	EquipmentSchema,
	LLMConfigSchema,
} from './common.js';

export const AgentSchema = z.object({
	id: z.string().regex(/^agent-[a-z0-9-]+$/),
	name: z.string().min(1),
	kind: z.string(),
	attributes: z.object({
		ST: z.number().int().min(ATTRIBUTE_RANGE.min).max(ATTRIBUTE_RANGE.max),
		DX: z.number().int().min(ATTRIBUTE_RANGE.min).max(ATTRIBUTE_RANGE.max),
		IQ: z.number().int().min(ATTRIBUTE_RANGE.min).max(ATTRIBUTE_RANGE.max),
		HT: z.number().int().min(ATTRIBUTE_RANGE.min).max(ATTRIBUTE_RANGE.max),
	}),
	social: z.object({
		status: z.number().int().min(STATUS_RANGE.min).max(STATUS_RANGE.max),
		reputation: z.number().int().min(REPUTATION_RANGE.min).max(REPUTATION_RANGE.max),
		charisma: z.number().int().min(CHARISMA_RANGE.min).max(CHARISMA_RANGE.max),
	}),
	needs: z.object({
		hunger: z.number().min(NEED_RANGE.min).max(NEED_RANGE.max),
		energy: z.number().min(NEED_RANGE.min).max(NEED_RANGE.max),
		social: z.number().min(NEED_RANGE.min).max(NEED_RANGE.max),
	}),
	/** Bootstrap sentinel — MoodSystem recalculates from needs/social each tick (GDD §4.5) */
	mood: z.number().min(MOOD_RANGE.min).max(MOOD_RANGE.max).default(MOOD_DEFAULT),
	memory: z.array(MemoryEntrySchema).default([]),
	goals: z.array(GoalSchema).default([]),
	skills: z.array(SkillEntrySchema).default([]),
	inventory: z.array(InventoryItemSchema).default([]),
	equipment: EquipmentSchema.default({ head: null, body: null, hands: null, tool: null, accessory: null }),
	traits: z.array(z.string()).default([]),
	wallet: z.object({ gold: z.number().min(0) }),
	xp: z.number().min(0).default(0),
	level: z.number().int().min(1).default(1),
	position: PositionSchema,
	relationships: z.string().default('graphs/relationships.canvas'),
	llm: LLMConfigSchema.optional(),
	tools: z.array(z.string()).default([]),
	behavior_tree: z.string(),
	job: z.string().nullable().default(null),
	property: z.array(z.string()).default([]),
});

export type Agent = z.infer<typeof AgentSchema>;
