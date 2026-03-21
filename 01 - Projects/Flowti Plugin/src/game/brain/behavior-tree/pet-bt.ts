/**
 * pet-bt.ts — Behavior tree factory for pet actors.
 *
 * Replaces the hardcoded PetActor state machine with a BT.
 * The BT decides what to do (sleep, wander, follow, exit);
 * the PetActor handles per-frame movement execution.
 */

import { BehaviourTree } from "mistreevous";
import { State } from "mistreevous";
import type { AgentBT } from "./bt-factory.js";
import type { CollectedAction } from "./bt-types.js";

export type PetState = "idle" | "wandering" | "sleeping" | "following" | "exiting";

export interface PetBTContext {
	name: string;
	state: PetState;
	sleepChance: number;
	wanderRadius: number;
	followTarget: string | null;
	followTimer: number;
	stateTimer: number;
	speed: number;
}

export interface PetBTObject {
	readonly context: PetBTContext;
	readonly collectedActions: CollectedAction[];
	HasExitTarget(): boolean;
	HasFollowTarget(): boolean;
	FollowTimeElapsed(): boolean;
	SleepChanceRoll(): boolean;
	WanderChanceRoll(): boolean;
	WalkToExit(): State;
	FollowAgent(): State;
	ReturnHome(): State;
	Nap(): State;
	PickWanderPoint(): State;
	WalkToPoint(): State;
	Idle(): State;
}

const PET_MASTER_MDSL = `root {
	selector {
		sequence {
			condition [HasExitTarget]
			action [WalkToExit]
		}
		sequence {
			condition [HasFollowTarget]
			action [FollowAgent]
			condition [FollowTimeElapsed]
			action [ReturnHome]
		}
		sequence {
			condition [SleepChanceRoll]
			action [Nap]
		}
		sequence {
			condition [WanderChanceRoll]
			action [PickWanderPoint]
			action [WalkToPoint]
		}
		action [Idle]
	}
}`;

export function createPetBT(
	name: string,
	sleepChance: number,
	wanderRadius: number,
	speed: number,
): AgentBT {
	const context: PetBTContext = {
		name,
		state: "idle",
		sleepChance,
		wanderRadius,
		followTarget: null,
		followTimer: 0,
		stateTimer: 0,
		speed,
	};

	const collectedActions: CollectedAction[] = [];

	function collect(type: string, data: Record<string, unknown> = {}): void {
		collectedActions.push({ type, data });
	}

	// ── Conditions ──────────────────────────────────────────

	function HasExitTarget(): boolean {
		return context.state === "exiting";
	}

	function HasFollowTarget(): boolean {
		return context.followTarget !== null && context.followTimer > 0;
	}

	function FollowTimeElapsed(): boolean {
		return context.followTimer <= 0;
	}

	function SleepChanceRoll(): boolean {
		return context.state === "idle" && Math.random() < context.sleepChance;
	}

	function WanderChanceRoll(): boolean {
		return context.state === "idle" && context.stateTimer <= 0;
	}

	// ── Actions ─────────────────────────────────────────────

	function WalkToExit(): State {
		collect("pet-exit", { name: context.name });
		return State.SUCCEEDED;
	}

	function FollowAgent(): State {
		context.state = "following";
		collect("pet-follow", { name: context.name, target: context.followTarget });
		return State.SUCCEEDED;
	}

	function ReturnHome(): State {
		context.followTarget = null;
		context.state = "idle";
		context.stateTimer = 5000;
		collect("pet-return-home", { name: context.name });
		return State.SUCCEEDED;
	}

	function Nap(): State {
		context.state = "sleeping";
		context.stateTimer = 5000 + Math.random() * 10000;
		collect("pet-sleep", { name: context.name });
		return State.SUCCEEDED;
	}

	function PickWanderPoint(): State {
		context.state = "wandering";
		context.stateTimer = 3000 + Math.random() * 4000;
		collect("pet-wander", { name: context.name, radius: context.wanderRadius });
		return State.SUCCEEDED;
	}

	function WalkToPoint(): State {
		collect("pet-walk", { name: context.name });
		return State.SUCCEEDED;
	}

	function Idle(): State {
		context.state = "idle";
		collect("pet-idle", { name: context.name });
		return State.SUCCEEDED;
	}

	const agent: PetBTObject = {
		context,
		collectedActions,
		HasExitTarget, HasFollowTarget, FollowTimeElapsed,
		SleepChanceRoll, WanderChanceRoll,
		WalkToExit, FollowAgent, ReturnHome,
		Nap, PickWanderPoint, WalkToPoint, Idle,
	};

	const tree = new BehaviourTree(PET_MASTER_MDSL, agent as unknown as Record<string, unknown>);

	// Bridge: PetBTObject is not a BTAgentObject, but AgentBT just needs tree + agent.
	// We cast to satisfy the interface — btTick only accesses tree.step() and agent.collectedActions.
	return { tree, agent: agent as unknown as import("./bt-agent.js").BTAgentObject };
}
