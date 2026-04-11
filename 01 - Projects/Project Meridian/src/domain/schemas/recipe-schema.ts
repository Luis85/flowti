import { z } from 'zod';

export const RecipeSchema = z.object({
	id: z.string().regex(/^recipe-[a-z0-9-]+$/),
	name: z.string().min(1),
	inputs: z.array(z.object({
		item_id: z.string(),
		quantity: z.number().int().min(1),
	})).default([]),
	outputs: z.array(z.object({
		item_id: z.string(),
		quantity: z.number().int().min(1),
	})).min(1),
	ticks_per_cycle: z.number().int().min(1),
	required_skill: z.string().nullable().default(null),
	min_skill_level: z.number().int().min(0).default(0),
});

export type Recipe = z.infer<typeof RecipeSchema>;
