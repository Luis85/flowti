import type { BrainState, BrainEvent, BrainResult, BrainParams, MovementTarget } from "./brain-types.js";
import type { AgentAttributes } from "../data/types.js";

const NO_MOVE: MovementTarget = { kind: "none" };
const TO_WORKSTATION: MovementTarget = { kind: "workstation" };

type TransitionFn = (event: BrainEvent) => BrainResult | null;

const TRANSITIONS: Record<string, TransitionFn> = {
	"task-started": () => ({ state: "walking-to", target: TO_WORKSTATION }),
	"task-completed": () => ({ state: "idle", target: NO_MOVE }),
	"speaking": () => ({ state: "talking", target: { kind: "agent" } }),
	"thinking": () => ({ state: "working", target: TO_WORKSTATION }),
	"asking": () => ({ state: "waiting", target: NO_MOVE }),
	"using-tool": () => ({ state: "working", target: TO_WORKSTATION }),
	"idle": () => ({ state: "idle", target: NO_MOVE }),
	"error": () => ({ state: "idle", target: NO_MOVE }),
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
		idleResistance: 3000 + (con / 20) * 17000,
		quoteFrequency: 30000 - (wis / 20) * 15000,
	};
}
