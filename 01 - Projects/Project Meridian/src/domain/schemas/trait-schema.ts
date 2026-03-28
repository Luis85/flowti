import { z } from 'zod';
import { TRAIT_CATEGORIES, TRAIT_ASSIGNABLE_BY } from './ranges.js';

export const TraitEffectSchema = z.object({
	/** GDD §23 mandates enum validation — deferred until tick systems are defined (Chunk D+) */
	system: z.string(),
	modifier: z.record(z.string(), z.unknown()),
});

export const TraitSchema = z.object({
	id: z.string().regex(/^trait-[a-z0-9-]+$/),
	name: z.string().min(1),
	description: z.string(),
	category: z.enum(TRAIT_CATEGORIES),
	effects: z.array(TraitEffectSchema),
	assignable_by: z.enum(TRAIT_ASSIGNABLE_BY),
	stackable: z.boolean().default(false),
	conflicts_with: z.array(z.string()).default([]),
});

export type Trait = z.infer<typeof TraitSchema>;
