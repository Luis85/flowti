import type { NeedsState, MoodState, PerceptionState } from '../core/component-data.js';
import type { GameRNG } from '../core/game-rng.js';
import type { BTNode } from '../schemas/behavior-tree-schema.js';
import { NEED_CRITICAL_THRESHOLDS } from '../schemas/ranges.js';

export type { BTNode } from '../schemas/behavior-tree-schema.js';

export interface BTContext {
	needs: NeedsState;
	mood: MoodState;
	perception: PerceptionState;
	timePhase: string;
	rng: GameRNG;
	interactionRadius: number;
	wallet: number;
	inventory: { item_id: string; quantity: number }[];
	job: string | null;
	nearbyFacilities: {
		id: string;
		job: string;
		stock: { item_id: string; quantity: number }[];
	}[];
}

export type BTStatus = 'success' | 'failure';

export interface BTResult {
	status: BTStatus;
	action: string | null;
	params: Record<string, unknown>;
}

type ConditionCheck = (ctx: BTContext, params: Record<string, unknown>) => boolean;

function needValue(needs: NeedsState, key: string): number {
	return (needs as unknown as Record<string, number>)[key] ?? 0;
}

const CONDITION_CHECKS: Record<string, ConditionCheck> = {
	need_critical(ctx, params) {
		const need = params.need as string;
		const threshold = (NEED_CRITICAL_THRESHOLDS as Record<string, number>)[need] ?? 20;
		return needValue(ctx.needs, need) < threshold;
	},
	need_below(ctx, params) {
		const need = params.need as string;
		const threshold = params.threshold as number;
		return needValue(ctx.needs, need) < threshold;
	},
	mood_is(ctx, params) {
		return ctx.mood.bucket === params.bucket;
	},
	time_is(ctx, params) {
		return ctx.timePhase === params.phase;
	},
	nearby_location(ctx, params) {
		return ctx.perception.nearbyLocations.some(l => l.type === (params.locationType as string));
	},
	nearby_agent(ctx) {
		return ctx.perception.nearbyAgents.length > 0;
	},
	at_location(ctx, params) {
		const type = params.locationType as string;
		return ctx.perception.nearbyLocations.some(
			l => l.type === type && l.distance <= ctx.interactionRadius,
		);
	},
	nearby_agent_close(ctx) {
		return ctx.perception.nearbyAgents.some(
			a => a.distance <= ctx.interactionRadius,
		);
	},
	chance(ctx, params) {
		return ctx.rng.chance(params.probability as number);
	},
	has_gold(ctx, params) {
		const amount = params.amount as number;
		return ctx.wallet >= amount;
	},
	has_item(ctx, params) {
		const itemId = params.itemId as string;
		return ctx.inventory.some(i => i.item_id === itemId && i.quantity > 0);
	},
	can_afford(ctx, params) {
		const price = params.price as number;
		const hasStock = ctx.nearbyFacilities.some(f => f.stock.length > 0);
		return hasStock && ctx.wallet >= price;
	},
	facility_has_stock(ctx, params) {
		const itemId = params.itemId as string;
		return ctx.nearbyFacilities.some(f =>
			f.stock.some(s => s.item_id === itemId && s.quantity > 0),
		);
	},
	has_job_facility(ctx) {
		if (ctx.job === null) return false;
		return ctx.nearbyFacilities.some(f => f.job === ctx.job);
	},
};

const FAILURE: BTResult = { status: 'failure', action: null, params: {} };
const SUCCESS_EMPTY: BTResult = { status: 'success', action: null, params: {} };

function evaluateSelector(children: BTNode[], context: BTContext): BTResult {
	for (const child of children) {
		const result = evaluateBT(child, context);
		if (result.status === 'success') return result;
	}
	return FAILURE;
}

function evaluateSequence(children: BTNode[], context: BTContext): BTResult {
	let lastResult: BTResult = SUCCESS_EMPTY;
	for (const child of children) {
		const result = evaluateBT(child, context);
		if (result.status === 'failure') return FAILURE;
		if (result.action !== null) lastResult = result;
	}
	return lastResult;
}

export function evaluateBT(node: BTNode, context: BTContext): BTResult {
	switch (node.type) {
		case 'action':
			return { status: 'success', action: node.action, params: node.params };
		case 'condition': {
			const check = CONDITION_CHECKS[node.check];
			if (check === undefined) return FAILURE;
			return check(context, node.params) ? SUCCESS_EMPTY : FAILURE;
		}
		case 'selector':
			return evaluateSelector(node.children, context);
		case 'sequence':
			return evaluateSequence(node.children, context);
	}
}
