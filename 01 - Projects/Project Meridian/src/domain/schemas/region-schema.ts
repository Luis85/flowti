import { z } from 'zod';

const RegionConnectionSchema = z.object({
	regionId: z.string().regex(/^region-[a-z0-9-]+$/),
	travel_cost: z.number().min(0).default(1),
});

export const RegionSchema = z.object({
	id: z.string().regex(/^region-[a-z0-9-]+$/),
	name: z.string().min(1),
	bounds: z.array(z.object({
		x: z.number(),
		y: z.number(),
	})).min(3),
	connections: z.array(RegionConnectionSchema).default([]),
	rest_tier: z.enum(['owned_home', 'public_shelter', 'outdoors']).nullable().default(null),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2a2a4a'),
});

export type WorldRegion = z.infer<typeof RegionSchema>;
