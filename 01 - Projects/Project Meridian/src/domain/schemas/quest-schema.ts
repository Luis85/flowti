import { z } from 'zod';

export const QUEST_TYPES = ['supply', 'restock', 'repair'] as const;
export const QUEST_STATES = ['open', 'claimed', 'completed', 'expired'] as const;

export const QuestSchema = z.object({
	id: z.string(),
	type: z.enum(QUEST_TYPES),
	facilityId: z.string(),
	itemId: z.string().nullable(),
	quantity: z.number().default(1),
	reward: z.number(),
	rewardXp: z.number().default(5),
	state: z.enum(QUEST_STATES).default('open'),
	claimedBy: z.string().nullable().default(null),
	createdTick: z.number(),
	expiryTicks: z.number(),
});

export type Quest = z.infer<typeof QuestSchema>;
export type QuestType = (typeof QUEST_TYPES)[number];
export type QuestState = (typeof QUEST_STATES)[number];

/** Runtime-only extension — repairProgress not persisted. */
export type QuestRuntime = Quest & { repairProgress: number };
