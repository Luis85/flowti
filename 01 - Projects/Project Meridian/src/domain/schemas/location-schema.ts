import { z } from 'zod';
import { PositionSchema } from './common.js';

export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	facility_type: z.string(),
	active_recipe: z.string().nullable().default(null),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#808080'),
	region: z.string().regex(/^region-[a-z0-9-]+$/).nullable().default(null),
	fund: z.number().optional(),
	stock: z.array(z.object({ item_id: z.string(), quantity: z.number() })).optional(),
});

export type WorldLocation = z.infer<typeof LocationSchema>;
