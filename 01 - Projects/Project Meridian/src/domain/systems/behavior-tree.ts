import type { NeedsState, MoodState, PerceptionState } from '../core/component-data.js';
import type { GameRNG } from '../core/game-rng.js';
import type { BTNode } from '../schemas/behavior-tree-schema.js';

export type { BTNode } from '../schemas/behavior-tree-schema.js';

export interface BTContext {
	needs: NeedsState;
	mood: MoodState;
	perception: PerceptionState;
	timePhase: string;
	rng: GameRNG;
}

export type BTStatus = 'success' | 'failure';

export interface BTResult {
	status: BTStatus;
	action: string | null;
	params: Record<string, unknown>;
}

const CRITICAL_THRESHOLDS: Record<string, number> = { hunger: 20, energy: 15, social: 25 };

type ConditionCheck = (ctx: BTContext, params: Record<string, unknown>) => boolean;

function needValue(needs: NeedsState, key: string): number {
	return (needs as unknown as Record<string, number>)[key] ?? 0;
}

const CONDITION_CHECKS: Record<string, ConditionCheck> = {
	need_critical(ctx, params) {
		const need = params.need as string;
		const threshold = CRITICAL_THRESHOLDS[need] ?? 20;
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
	chance(ctx, params) {
		return ctx.rng.chance(params.probability as number);
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
