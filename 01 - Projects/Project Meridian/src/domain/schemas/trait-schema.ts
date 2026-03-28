import { z } from 'zod';

export const TraitEffectSchema = z.object({
	system: z.string(),
	modifier: z.record(z.string(), z.unknown()),
});

export const TraitSchema = z.object({
	id: z.string().regex(/^trait-[a-z0-9-]+$/),
	name: z.string().min(1),
	description: z.string(),
	category: z.enum(['survival', 'social', 'economic', 'work', 'special']),
	effects: z.array(TraitEffectSchema),
	assignable_by: z.enum(['director', 'definition', 'milestone', 'inherited']),
	stackable: z.boolean().default(false),
	conflicts_with: z.array(z.string()).default([]),
});

export type Trait = z.infer<typeof TraitSchema>;
