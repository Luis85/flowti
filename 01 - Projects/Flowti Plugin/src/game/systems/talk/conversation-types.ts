/**
 * conversation-types.ts — Type definitions for the multi-turn conversation system.
 *
 * ConversationScript defines authored exchanges between agents/pets.
 * RunningJoke is a standalone type for jokes that escalate with repetition.
 */

import type { BubbleKind } from "./talk-types.js";
import type { AgentMood } from "./templates/mood-variants.js";
import type { RelationshipTier } from "../relationship-system.js";

// ── Conversation triggers ───────────────────────────────────────────

export type ConversationTrigger =
	| "proximity"
	| "work-finished"
	| "break"
	| "mood-event"
	| "gossip"
	| "pet-catalyst"
	| "tier-change"
	| "offline-return";

// ── Turn conditions ─────────────────────────────────────────────────

export type TurnCondition =
	| { readonly type: "mood"; readonly agent: "A" | "B"; readonly mood: AgentMood }
	| { readonly type: "tier"; readonly min: RelationshipTier }
	| { readonly type: "petPresent" }
	| { readonly type: "thirdAgentNearby" };

// ── Conversation turns ──────────────────────────────────────────────

export interface ConversationTurn {
	readonly speaker: "A" | "B" | "pet";
	readonly text: string;
	readonly delayMs: number;
	readonly kind: BubbleKind;
	readonly condition?: TurnCondition;
}

// ── Conversation scripts ────────────────────────────────────────────

export interface ConversationScript {
	readonly id: string;
	readonly tierRange: readonly [RelationshipTier, RelationshipTier];
	readonly domainFilter?: readonly [string, string] | null;
	readonly trigger: ConversationTrigger;
	readonly weight: number;
	readonly cooldownMs: number;
	readonly tags: readonly string[];
	readonly turns: readonly ConversationTurn[];
}

// ── Running jokes ───────────────────────────────────────────────────

export interface RunningJoke {
	readonly id: string;
	readonly tierRange: readonly [RelationshipTier, RelationshipTier];
	readonly domainFilter?: readonly [string, string] | null;
	readonly trigger: ConversationTrigger;
	readonly weight: number;
	readonly cooldownMs: number;
	readonly tags: readonly string[];
	readonly variants: readonly (readonly ConversationTurn[])[];
	readonly maxEscalation: number;
	readonly callbackChance: number;
	readonly callbackLines: readonly string[];
}
