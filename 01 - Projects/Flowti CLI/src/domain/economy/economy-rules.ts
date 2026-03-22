import type { TaskTrustTier } from "../tasks/task-types.js";

interface RewardContext {
	readonly trustTier: TaskTrustTier;
	readonly isFirstCompletion: boolean;
	readonly isStandingOrder: boolean;
	readonly isDelegation: boolean;
}

const TRUST_MULTIPLIER: Readonly<Record<TaskTrustTier, number>> = {
	auto: 1.0,
	review: 1.2,
	manual: 1.0,
};

export function calculateReward(
	base: { readonly xp: number; readonly coin: number },
	ctx: RewardContext,
): { readonly xp: number; readonly coin: number } {
	let multiplier = TRUST_MULTIPLIER[ctx.trustTier];
	if (ctx.isFirstCompletion) multiplier *= 1.5;
	if (ctx.isStandingOrder) multiplier *= 0.3;
	if (ctx.isDelegation) multiplier *= 0.2;

	return {
		xp: Math.round(base.xp * multiplier),
		coin: Math.round(base.coin * multiplier),
	};
}
