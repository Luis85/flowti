/**
 * bt-agent-extensions.ts — Hunger/thirst/journey conditions and actions for BTAgent.
 *
 * Extracted from bt-agent.ts to keep that file within the line-count limit.
 * All functions receive the agent context and deps by closure from createBTAgent.
 */

import { fromNodeState, type State } from "./bt-service.js";
import type { AgentToolDeps, BTAgentContext, CollectedAction } from "./bt-types.js";

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

export function Eat(ctx: BTAgentContext, collect: (type: string, data?: Record<string, unknown>) => void): State {
	ctx.needs.hunger = Math.min(100, ctx.needs.hunger + 30);
	collect("idle");
	return fromNodeState("succeeded");
}

export function Drink(ctx: BTAgentContext, collect: (type: string, data?: Record<string, unknown>) => void): State {
	ctx.needs.thirst = Math.min(100, ctx.needs.thirst + 30);
	collect("idle");
	return fromNodeState("succeeded");
}

// ── Journey action ─────────────────────────────────────────────────────

// Stub: actual journey execution wires to SSE event contract (deferred)
export function ExecuteJourney(): State {
	return fromNodeState("succeeded");
}
