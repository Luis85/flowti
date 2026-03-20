/**
 * sensor-rules.ts — Sensor event types, rule definitions, and defaults.
 *
 * SensorRules map workspace events (test results, builds, file changes) to
 * agent reactions. The first matching rule wins per event. Each rule carries
 * its own cooldown. A global cooldown and per-agent cooldown are enforced
 * by SensorSystem on top.
 */

import type { BubbleKind } from "../systems/talk/talk-types.js";
import type { AgentNeeds } from "../systems/needs-system.js";

// ── Event types ────────────────────────────────────────────────────────

export type SensorEventType =
	| "test-pass"
	| "test-fail"
	| "test-delta"
	| "build-success"
	| "build-failure"
	| "health-improved"
	| "health-dropped"
	| "iteration-milestone"
	| "file-saved"
	| "file-opened";

// ── Core data shapes ──────────────────────────────────────────────────

/** Incoming workspace event fed into the SensorSystem. */
export interface SensorEventData {
	type: SensorEventType;
	data: Record<string, unknown>;
}

/**
 * A resolved reaction produced by the SensorSystem after rule evaluation.
 * Consumed by the game scene to drive bubble / emote / needs / brain effects.
 */
export interface SensorReaction {
	agentName: string;
	bubble?: { kind: BubbleKind; text: string };
	emote?: number;
	needsEffect?: Partial<AgentNeeds>;
	brainEvent?: string;
}

/** Per-rule override that can disable a rule or change its cooldown. */
export interface SensorRuleOverride {
	ruleId: string;
	/** Set to a negative value to disable the rule. */
	cooldownMs: number;
}

// ── Rule definition ───────────────────────────────────────────────────

export interface SensorRule {
	id: string;
	event: SensorEventType;
	/** Optional predicate — if omitted the rule always matches. */
	condition?: (data: Record<string, unknown>) => boolean;
	/** How to select the target agent. */
	agentFilter: "nearest-domain" | "all" | "domain-match";
	/** Domain hint used when agentFilter is "domain-match". */
	domainHint?: string;
	reaction: {
		bubble?: { kind: BubbleKind; template: string };
		emote?: number;
		needsEffect?: Partial<AgentNeeds>;
		brainEvent?: string;
	};
	/** Per-rule cooldown in ms. */
	cooldown: number;
}

// ── Default rules ─────────────────────────────────────────────────────

export const DEFAULT_SENSOR_RULES: readonly SensorRule[] = [
	{
		id: "test-pass",
		event: "test-pass",
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "speech", template: "Tests are green! 🟢" },
			emote: 1,
			needsEffect: { morale: 3, focus: 2 },
		},
		cooldown: 30_000,
	},
	{
		id: "test-fail",
		event: "test-fail",
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "speech", template: "Tests are failing — let's dig in." },
			emote: 2,
			needsEffect: { morale: -4, focus: -2 },
			brainEvent: "thinking",
		},
		cooldown: 20_000,
	},
	{
		id: "test-delta-regression",
		event: "test-delta",
		condition: (data) => typeof data["delta"] === "number" && (data["delta"] as number) < 0,
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "thought", template: "Coverage dropped. We should fix that." },
			emote: 2,
			needsEffect: { morale: -2 },
		},
		cooldown: 60_000,
	},
	{
		id: "build-success",
		event: "build-success",
		agentFilter: "nearest-domain",
		domainHint: "engineering",
		reaction: {
			bubble: { kind: "speech", template: "Build passed! Ship it." },
			emote: 1,
			needsEffect: { morale: 2 },
		},
		cooldown: 30_000,
	},
	{
		id: "build-failure",
		event: "build-failure",
		agentFilter: "nearest-domain",
		domainHint: "engineering",
		reaction: {
			bubble: { kind: "speech", template: "Build broke. On it." },
			emote: 2,
			needsEffect: { morale: -3, focus: -2 },
			brainEvent: "thinking",
		},
		cooldown: 20_000,
	},
	{
		id: "health-improved",
		event: "health-improved",
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "thought", template: "Health score is up. Nice work." },
			emote: 1,
			needsEffect: { morale: 2 },
		},
		cooldown: 60_000,
	},
	{
		id: "health-dropped",
		event: "health-dropped",
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "thought", template: "Health score dropped. Something needs attention." },
			emote: 2,
			needsEffect: { morale: -2 },
		},
		cooldown: 60_000,
	},
	{
		id: "iteration-milestone",
		event: "iteration-milestone",
		agentFilter: "all",
		reaction: {
			bubble: { kind: "speech", template: "Milestone reached! Great progress." },
			emote: 1,
			needsEffect: { morale: 5, social: 3 },
		},
		cooldown: 120_000,
	},
	{
		id: "file-saved",
		event: "file-saved",
		agentFilter: "domain-match",
		reaction: {
			bubble: { kind: "thought", template: "Someone's been busy in there." },
		},
		cooldown: 15_000,
	},
	{
		id: "file-opened",
		event: "file-opened",
		agentFilter: "domain-match",
		reaction: {
			bubble: { kind: "thought", template: "Working on something?" },
		},
		cooldown: 30_000,
	},
];
