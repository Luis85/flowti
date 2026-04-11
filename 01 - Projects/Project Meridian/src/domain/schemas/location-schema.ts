import { z } from 'zod';
import { PositionSchema } from './common.js';

export const LOCATION_TYPES = ['rest', 'food', 'social', 'work', 'market', 'water', 'leisure'] as const;

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
	auto_ticks_per_cycle: z.number().int().nullable().default(60),
	funding: z.enum(['facility', 'treasury']).default('facility'),
}).nullable().default(null);

const LeisureEffectsSchema = z.object({
	social: z.number().default(0),
	mood: z.number().default(0),
	energy: z.number().default(0),
	skill_xp: z.number().default(0),
});

export const LeisureConfigSchema = z.object({
	cost: z.number().min(0),
	effects: LeisureEffectsSchema,
	attribute_bonus: z.string().nullable().default(null),
	ticks_per_visit: z.number().int().min(1).default(15),
}).nullable().default(null);

export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	type: z.enum(LOCATION_TYPES),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#808080'),
	production: ProductionSchema,
	leisure: LeisureConfigSchema,
	region: z.string().regex(/^region-[a-z0-9-]+$/).nullable().default(null),
	fund: z.number().optional(),
	stock: z.array(z.object({ item_id: z.string(), quantity: z.number() })).optional(),
	facility_type: z.string().optional(),
	active_recipe: z.string().nullable().default(null),
});

export type WorldLocation = z.infer<typeof LocationSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type LeisureConfig = z.infer<typeof LeisureConfigSchema>;
