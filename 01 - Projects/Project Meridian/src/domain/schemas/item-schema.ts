import { z } from 'zod';

export const ITEM_CATEGORIES = ['subsistence', 'comfort', 'trade_goods', 'luxury'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	baseValue: z.number().min(0),
	category: z.enum(ITEM_CATEGORIES).default('trade_goods'),
});

export type Item = z.infer<typeof ItemSchema>;
