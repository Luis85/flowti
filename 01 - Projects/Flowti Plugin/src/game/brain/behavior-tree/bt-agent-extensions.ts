/**
 * bt-agent-extensions.ts — Hunger/thirst/journey/merchant conditions and actions for BTAgent.
 *
 * Extracted from bt-agent.ts to keep that file within the line-count limit.
 * All functions receive the agent context and deps by closure from createBTAgent.
 *
 * Actions write to the blackboard (via deps.blackboard) — no collect(), no
 * brain bridge. The blackboard is the single data bus between BT and all
 * other systems.
 */

import { fromNodeState, type State } from "./bt-service.js";
import type { AgentToolDeps, BTAgentContext } from "./bt-types.js";
import { getPreferredFoodStation, getPreferredDrinkStation } from "../../data/food-preferences.js";

export interface BTAgentExtensionDeps {
	context: BTAgentContext;
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
	const bb = ext.deps.blackboard;
	bb.intent = "seeking";
	bb.intentDetail = "seek-food";
	bb.movementCommand = "walk-to";
	bb.movementTarget = bb.nearestFoodStation;
	return fromNodeState("succeeded");
}

export function SeekDrinkStation(ext: BTAgentExtensionDeps): State {
	const bb = ext.deps.blackboard;
	bb.intent = "seeking";
	bb.intentDetail = "seek-drink";
	bb.movementCommand = "walk-to";
	bb.movementTarget = bb.nearestDrinkStation;
	return fromNodeState("succeeded");
}

export function Eat(ctx: BTAgentContext): State {
	ctx.needs.hunger = Math.min(100, ctx.needs.hunger + 30);
	return fromNodeState("succeeded");
}

export function Drink(ctx: BTAgentContext): State {
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
	const bb = ext.deps.blackboard;
	bb.intent = "seeking";
	bb.intentDetail = `seek-preferred-food:${station}`;
	bb.movementCommand = "walk-to";
	bb.movementTarget = bb.nearestFoodStation;
	return fromNodeState("succeeded");
}

export function SeekPreferredDrinkStation(ext: BTAgentExtensionDeps): State {
	const station = getPreferredDrinkStation(ext.context.quirks);
	if (!station) return fromNodeState("failed");
	const bb = ext.deps.blackboard;
	bb.intent = "seeking";
	bb.intentDetail = `seek-preferred-drink:${station}`;
	bb.movementCommand = "walk-to";
	bb.movementTarget = bb.nearestDrinkStation;
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

export function IsMerchantEligible(
	ctx: BTAgentContext,
	trustTier: string | undefined,
): boolean {
	if (ctx.level < MERCHANT_MIN_LEVEL) return false;
	return TRUSTED_TIERS.has(trustTier ?? "supervised");
}

export function HasNotVisitedMerchantThisCycle(
	ctx: BTAgentContext,
	getCycleCount: () => number,
): boolean {
	return ctx.lastMerchantVisitCycle < getCycleCount();
}

export function HasAutoPurchaseAvailable(ext: BTAgentExtensionDeps): boolean {
	if (!ext.deps.merchant) return false;
	return ext.deps.merchant.shouldAutoPurchase(ext.context.name);
}

// ── Merchant actions ─────────────────────────────────────────────────

export function SeekMerchantStall(ext: BTAgentExtensionDeps): State {
	const bb = ext.deps.blackboard;
	bb.intent = "seeking";
	bb.intentDetail = "seek-merchant";
	bb.movementCommand = "walk-to";
	bb.movementTarget = null; // merchant stall position resolved by sensor phase
	return fromNodeState("succeeded");
}

export function BrowseMerchant(ext: BTAgentExtensionDeps): State {
	ext.deps.blackboard.intentDetail = "browsing-merchant";
	return fromNodeState("succeeded");
}

export function ExecuteMerchantPurchase(ext: BTAgentExtensionDeps): State {
	if (!ext.deps.merchant) return fromNodeState("failed");

	const item = ext.deps.merchant.getAutoPurchaseItem(ext.context.name);
	if (!item) return fromNodeState("failed");

	void ext.deps.merchant.purchase(ext.context.name, item.id);
	ext.context.lastMerchantVisitCycle = ext.deps.merchant.getCycleCount();

	return fromNodeState("succeeded");
}
