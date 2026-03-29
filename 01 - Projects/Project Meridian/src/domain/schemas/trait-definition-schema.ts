import { z } from 'zod';

export const TraitDefinitionSchema = z.object({
	id: z.string().min(1),
	effects: z.array(z.object({
		system: z.string(),
		modifier: z.record(z.string(), z.unknown()),
	})).default([]),
	conflicts_with: z.array(z.string()).default([]),
});

export type TraitDefinitionData = z.infer<typeof TraitDefinitionSchema>;
