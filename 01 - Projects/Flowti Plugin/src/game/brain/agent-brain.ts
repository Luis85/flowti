import type { BrainState, BrainEvent, BrainResult, BrainParams, MovementTarget, AgentHabits } from "./brain-types.js";
import type { AgentAttributes } from "../data/types.js";
import { resolveSettingForDomain } from "../config/domain-map.js";
import { DEFAULT_WORLD_CONFIG } from "../data/world-config.js";

const NO_MOVE: MovementTarget = { kind: "none" };
const TO_WORKSTATION: MovementTarget = { kind: "workstation" };

type TransitionFn = (event: BrainEvent) => BrainResult | null;

const TRANSITIONS: Record<string, TransitionFn> = {
	"task-started": () => ({ state: "walking-to", target: TO_WORKSTATION }),
	"task-completed": () => ({ state: "idle", target: NO_MOVE }),
	"goal-started": () => ({ state: "walking-to", target: TO_WORKSTATION }),
	"goal-completed": () => ({ state: "idle", target: NO_MOVE }),
	"speaking": () => ({ state: "talking", target: { kind: "agent" } }),
	"thinking": () => ({ state: "working", target: TO_WORKSTATION }),
	"asking": () => ({ state: "waiting", target: NO_MOVE }),
	"using-tool": () => ({ state: "working", target: TO_WORKSTATION }),
	"idle": () => ({ state: "idle", target: NO_MOVE }),
	"error": () => ({ state: "idle", target: NO_MOVE }),
	"queued": () => ({ state: "waiting" as BrainState, target: NO_MOVE }),
	"seek-rest": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
	"seek-food": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
	"seek-drink": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
	"seek-merchant": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
	"seek-agent": () => ({ state: "walking-to" as BrainState, target: { kind: "agent" } as MovementTarget }),
	"seek-quiet": () => ({ state: "wandering" as BrainState, target: NO_MOVE }),
	"break": () => ({ state: "on-break" as BrainState, target: NO_MOVE }),
};

const WAITING_OVERRIDES: Record<string, TransitionFn> = {
	"permission-granted": () => ({ state: "working", target: TO_WORKSTATION }),
	"permission-denied": () => ({ state: "idle", target: NO_MOVE }),
};

export function transition(current: BrainState, event: BrainEvent): BrainResult {
	if (current === "waiting") {
		const override = WAITING_OVERRIDES[event.type];
		if (override) return override(event)!;
	}
	const fn = TRANSITIONS[event.type];
	return fn?.(event) ?? { state: current, target: NO_MOVE };
}

const DEFAULT_ATTR = 10;
const MIN_SPEED = 0.5;
const MAX_SPEED = 1.5;

export function computeParams(attrs: AgentAttributes): BrainParams {
	const dex = attrs.dex ?? DEFAULT_ATTR;
	const cha = attrs.cha ?? DEFAULT_ATTR;
	const int = attrs.int ?? DEFAULT_ATTR;
	const con = attrs.con ?? DEFAULT_ATTR;
	const wis = attrs.wis ?? DEFAULT_ATTR;
	return {
		speedMultiplier: MIN_SPEED + ((dex - 1) / 19) * (MAX_SPEED - MIN_SPEED),
		socialRadius: 50 + (cha / 20) * 150,
		focusDuration: 5000 + (int / 20) * 25000,
		idleResistance: DEFAULT_WORLD_CONFIG.behavior.idleResistanceBase + (con / 20) * DEFAULT_WORLD_CONFIG.behavior.idleResistanceCONScale,
		quoteFrequency: 30000 - (wis / 20) * 15000,
	};
}

export function deriveMovementStyle(dex: number): AgentHabits["movementStyle"] {
	return dex <= 7 ? "deliberate" : dex <= 13 ? "brisk" : "darting";
}

export function deriveIdleStyle(con: number): AgentHabits["idleStyle"] {
	return con <= 7 ? "fidgety" : con <= 13 ? "restless" : "calm";
}

/** Derive personality habits from attributes, mood, and domain. */
export function computeHabits(attrs: AgentAttributes, mood: string, domain: string): AgentHabits {
	const dex = attrs.dex ?? DEFAULT_ATTR;
	const cha = attrs.cha ?? DEFAULT_ATTR;
	const int = attrs.int ?? DEFAULT_ATTR;
	const con = attrs.con ?? DEFAULT_ATTR;
	const wis = attrs.wis ?? DEFAULT_ATTR;

	const movementStyle = deriveMovementStyle(dex);
	const idleStyle = deriveIdleStyle(con);

	let socialDrift = cha / 20;
	let breakThreshold = 10 + con * 2;
	const settlingPause = 200 + wis * 50;

	// Mood multipliers (per spec A6)
	let idleResistanceMult = 1.0;
	let speedMult = 1.0;

	if (mood === "happy") {
		idleResistanceMult = 1.2;
	} else if (mood === "frustrated") {
		idleResistanceMult = 0.7;
		speedMult = 1.15;
	} else if (mood === "focused") {
		breakThreshold *= 1.4;
		socialDrift *= 0.5;
	}

	return {
		preferredWorkstationId: null,
		homeRoom: resolveSettingForDomain(domain),
		movementStyle,
		idleStyle,
		socialDrift,
		focusDrift: int / 20,
		breakThreshold,
		settlingPause,
		idleResistanceMult,
		speedMult,
	};
}
