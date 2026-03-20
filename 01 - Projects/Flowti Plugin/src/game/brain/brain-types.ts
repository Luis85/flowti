import type { AgentAttributes, AgentActionType } from "../data/types.js";

export type BrainState = "idle" | "wandering" | "walking-to" | "working" | "talking" | "waiting" | "on-break";

export interface BrainEvent {
	readonly type: AgentActionType;
	readonly data?: Record<string, unknown>;
}

export interface MovementTarget {
	readonly kind: "wander" | "workstation" | "agent" | "doorway" | "custom" | "none";
	readonly x?: number;
	readonly y?: number;
	readonly targetId?: string;
}

export interface BrainResult {
	readonly state: BrainState;
	readonly target: MovementTarget;
}

export interface BrainConfig {
	readonly attributes: AgentAttributes;
	readonly personality?: readonly string[];
	readonly mood?: string;
}

/** Attribute-derived parameters for movement and behavior. */
export interface BrainParams {
	readonly speedMultiplier: number;     // DEX: 0.5 to 1.5
	readonly socialRadius: number;        // CHA: distance toward other agents
	readonly focusDuration: number;       // INT: ms at workstation before wandering
	readonly idleResistance: number;      // CON: ms before idle transition
	readonly quoteFrequency: number;      // WIS: ms between idle quotes
}

/** Personality-derived habits for movement and behavior patterns. */
export interface AgentHabits {
	preferredWorkstationId: string | null;
	readonly homeRoom: string;
	readonly movementStyle: "deliberate" | "brisk" | "darting";
	readonly idleStyle: "fidgety" | "calm" | "restless";
	socialDrift: number;
	readonly focusDrift: number;
	breakThreshold: number;
	readonly settlingPause: number;
	/** Mood multiplier for idle resistance (1.0 = neutral). */
	readonly idleResistanceMult: number;
	/** Mood multiplier for movement speed (1.0 = neutral). */
	readonly speedMult: number;
}
