import { z } from 'zod';
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
		ST: z.number().int().min(1).max(20),
		DX: z.number().int().min(1).max(20),
		IQ: z.number().int().min(1).max(20),
		HT: z.number().int().min(1).max(20),
	}),
	social: z.object({
		status: z.number().int().min(-4).max(8),
		reputation: z.number().int().min(-4).max(4),
		charisma: z.number().int().min(1).max(20),
	}),
	needs: z.object({
		hunger: z.number().min(0).max(100),
		energy: z.number().min(0).max(100),
		social: z.number().min(0).max(100),
	}),
	/** Bootstrap sentinel — MoodSystem recalculates from needs/social each tick (GDD §4.5) */
	mood: z.number().min(-100).max(100).default(50),
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
