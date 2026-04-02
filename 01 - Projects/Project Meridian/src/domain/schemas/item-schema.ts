import { z } from 'zod';

export const ITEM_CATEGORIES = ['subsistence', 'comfort', 'trade_goods', 'luxury', 'tool'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	baseValue: z.number().min(0),
	category: z.enum(ITEM_CATEGORIES).default('trade_goods'),
	charges: z.number().optional(),
	maxCharges: z.number().optional(),
});

export type Item = z.infer<typeof ItemSchema>;
