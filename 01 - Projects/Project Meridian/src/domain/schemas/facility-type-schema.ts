import { z } from 'zod';

const CommonFields = z.object({
	id: z.string().regex(/^[a-z_]+$/),
	primary_job: z.string(),
	default_wage: z.number().min(0).default(3),
	default_fund: z.number().min(0).default(200),
	funding: z.enum(['facility', 'treasury']).default('facility'),
	capacity: z.literal(1).default(1),
});

const ProductionKindSchema = CommonFields.extend({
	kind: z.literal('production'),
	allowed_recipes: z.array(z.string()).min(1),
});

const ServiceEffectsSchema = z.object({
	mood: z.number().default(0),
	energy: z.number().default(0),
	social: z.number().default(0),
	skill_xp: z.number().default(0),
});

const ServiceKindSchema = CommonFields.extend({
	kind: z.literal('service'),
	staffed_effects: ServiceEffectsSchema,
	unstaffed_effects: ServiceEffectsSchema,
	cost_per_visit: z.number().min(0).default(0),
	ticks_per_visit: z.number().int().min(1).default(20),
	restock_threshold_per_item: z.record(z.string(), z.number().int().min(0)).default({}),
});

const AreaEffectKindSchema = CommonFields.extend({
	kind: z.literal('area_effect'),
	modifier: z.object({
		kind: z.enum(['mood']),
		delta_per_tick: z.number(),
	}),
	radius: z.number().int().min(1),
	ticks_per_pulse: z.number().int().min(1).default(30),
});

export const FacilityTypeSchema = z.discriminatedUnion('kind', [
	ProductionKindSchema,
	ServiceKindSchema,
	AreaEffectKindSchema,
]);

export type FacilityType = z.infer<typeof FacilityTypeSchema>;
