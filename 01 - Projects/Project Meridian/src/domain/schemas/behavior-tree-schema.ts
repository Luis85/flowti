import { z } from 'zod';

export type BTNode =
	| { type: 'selector'; children: BTNode[] }
	| { type: 'sequence'; children: BTNode[] }
	| { type: 'condition'; check: string; params: Record<string, unknown> }
	| { type: 'action'; action: string; params: Record<string, unknown> };

const BTConditionSchema = z.object({
	type: z.literal('condition'),
	check: z.string(),
	params: z.record(z.string(), z.unknown()).default({}),
});

const BTActionSchema = z.object({
	type: z.literal('action'),
	action: z.string(),
	params: z.record(z.string(), z.unknown()).default({}),
});

export const BTNodeSchema: z.ZodType<BTNode> = z.lazy(() =>
	z.discriminatedUnion('type', [
		z.object({ type: z.literal('selector'), children: z.array(BTNodeSchema) }),
		z.object({ type: z.literal('sequence'), children: z.array(BTNodeSchema) }),
		BTConditionSchema,
		BTActionSchema,
	]),
);

export const BehaviorTreeSchema = z.object({
	id: z.string(),
	root: BTNodeSchema,
});

export type BehaviorTree = z.infer<typeof BehaviorTreeSchema>;
