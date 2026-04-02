import { z } from 'zod';
import { PositionSchema } from './common.js';

export const LOCATION_TYPES = ['rest', 'food', 'social', 'work', 'market'] as const;

const ProductionOutputSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int(),
});

const ProductionInputSchema = z.object({
	item_id: z.string(),
	quantity: z.number().int(),
});

export const ProductionSchema = z.object({
	job: z.string(),
	output: ProductionOutputSchema,
	input: ProductionInputSchema.nullable().default(null),
	wage: z.number().default(5),
	ticks_per_cycle: z.number().int().default(30),
	auto_process: z.boolean().default(false),
	auto_ticks_per_cycle: z.number().int().default(60),
}).nullable().default(null);

export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	type: z.enum(LOCATION_TYPES),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#808080'),
	production: ProductionSchema,
	region: z.string().regex(/^region-[a-z0-9-]+$/).nullable().default(null),
});

export type WorldLocation = z.infer<typeof LocationSchema>;
export type Production = z.infer<typeof ProductionSchema>;
