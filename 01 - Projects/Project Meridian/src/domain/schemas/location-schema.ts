import { z } from 'zod';
import { PositionSchema } from './common.js';

export const LOCATION_TYPES = ['rest', 'food', 'social', 'work', 'market'] as const;

export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	type: z.enum(LOCATION_TYPES),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
});

export type WorldLocation = z.infer<typeof LocationSchema>;
