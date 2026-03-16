import type { AgentAttributes, AgentActionType } from "../data/types.js";

export type BrainState = "idle" | "wandering" | "walking-to" | "working" | "talking" | "waiting";

export interface BrainEvent {
	readonly type: AgentActionType;
	readonly data?: Record<string, unknown>;
}

export interface MovementTarget {
	readonly kind: "wander" | "workstation" | "agent" | "doorway" | "none";
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
