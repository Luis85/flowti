/**
 * bt-agent-extensions.ts — Hunger/thirst/journey/merchant conditions and actions for BTAgent.
 *
 * Extracted from bt-agent.ts to keep that file within the line-count limit.
 * All functions receive the agent context and deps by closure from createBTAgent.
 */

import { fromNodeState, type State } from "./bt-service.js";
import type { AgentToolDeps, BTAgentContext, CollectedAction } from "./bt-types.js";
import { getPreferredFoodStation, getPreferredDrinkStation } from "../../data/food-preferences.js";

export interface BTAgentExtensionDeps {
	context: BTAgentContext;
	collectedActions: CollectedAction[];
	collect: (type: string, data?: Record<string, unknown>) => void;
	deps: AgentToolDeps;
}

// ── Hunger/thirst conditions ─────────────────────────────────────────

export function IsHungry(ctx: BTAgentContext): boolean {
	return ctx.needs.hunger < 35;
}

export function IsThirsty(ctx: BTAgentContext): boolean {
	return ctx.needs.thirst < 30;
}

// ── Journey condition ─────────────────────────────────────────────────

// Stub: no journey tasks assigned via this system yet (SSE wiring deferred)
export function HasJourneyTask(_ctx: BTAgentContext): boolean {
	return false;
}

// ── Hunger/thirst actions ─────────────────────────────────────────────

export function SeekFoodStation(ext: BTAgentExtensionDeps): State {
	ext.collect("seek-food");
	ext.deps.brain?.applyEvent(ext.context.name, "seek-food");
	return fromNodeState("succeeded");
}

export function SeekDrinkStation(ext: BTAgentExtensionDeps): State {
	ext.collect("seek-drink");
	ext.deps.brain?.applyEvent(ext.context.name, "seek-drink");
	return fromNodeState("succeeded");
}

export function Eat(ctx: BTAgentContext, _collect: (type: string, data?: Record<string, unknown>) => void): State {
	ctx.needs.hunger = Math.min(100, ctx.needs.hunger + 30);
	return fromNodeState("succeeded");
}

export function Drink(ctx: BTAgentContext, _collect: (type: string, data?: Record<string, unknown>) => void): State {
	ctx.needs.thirst = Math.min(100, ctx.needs.thirst + 30);
	return fromNodeState("succeeded");
}

// ── Preference-based station conditions ──────────────────────────────────

export function HasPreferredFoodStation(ctx: BTAgentContext): boolean {
	return getPreferredFoodStation(ctx.quirks) !== null;
}

export function HasPreferredDrinkStation(ctx: BTAgentContext): boolean {
	return getPreferredDrinkStation(ctx.quirks) !== null;
}

// ── Preference-based station actions ─────────────────────────────────────

export function SeekPreferredFoodStation(ext: BTAgentExtensionDeps): State {
	const station = getPreferredFoodStation(ext.context.quirks);
	if (!station) return fromNodeState("failed");
	ext.collect("seek-preferred-food", { station });
	ext.deps.brain?.applyEvent(ext.context.name, "seek-food");
	return fromNodeState("succeeded");
}

export function SeekPreferredDrinkStation(ext: BTAgentExtensionDeps): State {
	const station = getPreferredDrinkStation(ext.context.quirks);
	if (!station) return fromNodeState("failed");
	ext.collect("seek-preferred-drink", { station });
	ext.deps.brain?.applyEvent(ext.context.name, "seek-drink");
	return fromNodeState("succeeded");
}

// ── Journey action ─────────────────────────────────────────────────────

// Stub: actual journey execution wires to SSE event contract (deferred)
export function ExecuteJourney(): State {
	return fromNodeState("succeeded");
}

// ── Merchant conditions ──────────────────────────────────────────────

const MERCHANT_MIN_LEVEL = 5;
const TRUSTED_TIERS: ReadonlySet<string> = new Set(["trusted", "autonomous"]);

/** Agent must be level 5+ and have "trusted" or "autonomous" trust tier. */
export function IsMerchantEligible(
	ctx: BTAgentContext,
	trustTier: string | undefined,
): boolean {
	if (ctx.level < MERCHANT_MIN_LEVEL) return false;
	return TRUSTED_TIERS.has(trustTier ?? "supervised");
}

/** Ensures only one merchant visit per day cycle. */
export function HasNotVisitedMerchantThisCycle(
	ctx: BTAgentContext,
	getCycleCount: () => number,
): boolean {
	return ctx.lastMerchantVisitCycle < getCycleCount();
}

/** Delegates to MerchantSystem.shouldAutoPurchase via the merchant bridge. */
export function HasAutoPurchaseAvailable(ext: BTAgentExtensionDeps): boolean {
	if (!ext.deps.merchant) return false;
	return ext.deps.merchant.shouldAutoPurchase(ext.context.name);
}

// ── Merchant actions ─────────────────────────────────────────────────

export function SeekMerchantStall(ext: BTAgentExtensionDeps): State {
	ext.collect("seek-merchant");
	ext.deps.brain?.applyEvent(ext.context.name, "seek-merchant");
	return fromNodeState("succeeded");
}

export function BrowseMerchant(ext: BTAgentExtensionDeps): State {
	ext.collect("browsing-merchant", {});
	return fromNodeState("succeeded");
}

export function ExecuteMerchantPurchase(ext: BTAgentExtensionDeps): State {
	if (!ext.deps.merchant) return fromNodeState("failed");

	const item = ext.deps.merchant.getAutoPurchaseItem(ext.context.name);
	if (!item) return fromNodeState("failed");

	// Fire-and-forget async purchase — BT actions are synchronous, so we
	// collect the action immediately and let the purchase resolve in the
	// background (same pattern as QueryLLM fire-and-poll but simpler since
	// we don't need to wait for a result to continue).
	void ext.deps.merchant.purchase(ext.context.name, item.id);

	ext.collect("merchant-purchase", { itemId: item.id, itemName: item.name });

	// Mark this cycle as visited so the subtree won't re-trigger
	ext.context.lastMerchantVisitCycle = ext.deps.merchant.getCycleCount();

	return fromNodeState("succeeded");
}
