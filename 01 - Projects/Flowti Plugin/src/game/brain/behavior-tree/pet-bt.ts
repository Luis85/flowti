/**
 * pet-bt.ts — Behavior tree factory for pet actors.
 *
 * Replaces the hardcoded PetActor state machine with a BT.
 * The BT decides what to do (sleep, wander, follow, exit);
 * the PetActor handles per-frame movement execution.
 */

import { createTree, fromNodeState, type State } from "./bt-service.js";
import type { AgentBT } from "./bt-factory.js";
import type { CollectedAction } from "./bt-types.js";
import type { IEchoStore } from "../../systems/echo/echo-types.js";

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
	petType: string;
	nearbyAgentMorale?: number;
	nearbyIdleAgent?: string;
	targetRoom?: string;
	currentRoom?: string;
	hunger: number;
	thirst: number;
	nearbyAgentCount?: number;
	nearbyAgents?: string[];
	echoStore?: IEchoStore;
}

export interface PetBTObject {
	readonly context: PetBTContext;
	readonly collectedActions: CollectedAction[];
	HasExitTarget(): boolean;
	HasFollowTarget(): boolean;
	FollowTimeElapsed(): boolean;
	SleepChanceRoll(): boolean;
	WanderChanceRoll(): boolean;
	IsHungry(): boolean;
	IsThirsty(): boolean;
	HasNearbyAgents(): boolean;
	HasSadNearbyAgent(): boolean;
	CatalystChanceRoll(): boolean;
	WalkToExit(): State;
	FollowAgent(): State;
	ReturnHome(): State;
	Nap(): State;
	PickWanderPoint(): State;
	WalkToPoint(): State;
	SeekFoodBowl(): State;
	SeekWaterBowl(): State;
	PetEat(): State;
	PetDrink(): State;
	Idle(): State;
	DragToy(): State;
	SitBetween(): State;
	BringGift(): State;
	StealSpotlight(): State;
	ComfortSadAgent(): State;
	PickSide(): State;
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
			condition [IsHungry]
			action [SeekFoodBowl]
			action [PetEat]
		}
		sequence {
			condition [IsThirsty]
			action [SeekWaterBowl]
			action [PetDrink]
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
		sequence {
			condition [CatalystChanceRoll]
			condition [HasNearbyAgents]
			selector {
				sequence {
					condition [HasSadNearbyAgent]
					action [ComfortSadAgent]
				}
				action [DragToy]
			}
		}
		action [Idle]
	}
}`;

export function createPetBT(
	name: string,
	sleepChance: number,
	wanderRadius: number,
	speed: number,
	petType: string = name.split("-")[0],
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
		petType,
		hunger: 70,
		thirst: 70,
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

	function IsHungry(): boolean {
		return context.hunger < 40;
	}

	function IsThirsty(): boolean {
		return context.thirst < 35;
	}

	function HasNearbyAgents(): boolean {
		return (context.nearbyAgentCount ?? 0) >= 2;
	}

	function HasSadNearbyAgent(): boolean {
		return (context.nearbyAgentMorale ?? 100) < 30;
	}

	function CatalystChanceRoll(): boolean {
		const bondBias = context.echoStore
			? context.echoStore.queryWeight(context.name, "bond") : 0;
		const multiplier = 1 + Math.max(-50, Math.min(50, bondBias)) / 100;
		return context.state === "idle" && Math.random() < 0.02 * multiplier;
	}

	// ── Actions ─────────────────────────────────────────────

	function WalkToExit(): State {
		collect("pet-exit", { name: context.name });
		return fromNodeState("succeeded");
	}

	function FollowAgent(): State {
		context.state = "following";
		collect("pet-follow", { name: context.name, target: context.followTarget });
		return fromNodeState("succeeded");
	}

	function ReturnHome(): State {
		context.followTarget = null;
		context.state = "idle";
		context.stateTimer = 5000;
		collect("pet-return-home", { name: context.name });
		return fromNodeState("succeeded");
	}

	function Nap(): State {
		context.state = "sleeping";
		context.stateTimer = 5000 + Math.random() * 10000;
		collect("pet-sleep", { name: context.name });
		return fromNodeState("succeeded");
	}

	function PickWanderPoint(): State {
		context.state = "wandering";
		context.stateTimer = 3000 + Math.random() * 4000;
		collect("pet-wander", { name: context.name, radius: context.wanderRadius });
		return fromNodeState("succeeded");
	}

	function WalkToPoint(): State {
		collect("pet-walk", { name: context.name });
		return fromNodeState("succeeded");
	}

	function SeekFoodBowl(): State {
		collect("pet-seek-food", { name: context.name });
		return fromNodeState("succeeded");
	}

	function SeekWaterBowl(): State {
		collect("pet-seek-water", { name: context.name });
		return fromNodeState("succeeded");
	}

	function PetEat(): State {
		context.hunger = Math.min(100, context.hunger + 30);
		collect("pet-eat", { name: context.name });
		return fromNodeState("succeeded");
	}

	function PetDrink(): State {
		context.thirst = Math.min(100, context.thirst + 25);
		collect("pet-drink", { name: context.name });
		return fromNodeState("succeeded");
	}

	function Idle(): State {
		context.state = "idle";
		collect("pet-idle", { name: context.name });
		return fromNodeState("succeeded");
	}

	// ── Catalyst Actions ────────────────────────────────────

	function DragToy(): State {
		collect("pet-drag-toy", { name: context.name, targets: context.nearbyAgents });
		return fromNodeState("succeeded");
	}

	function SitBetween(): State {
		collect("pet-sit-between", { name: context.name, targets: context.nearbyAgents });
		return fromNodeState("succeeded");
	}

	function BringGift(): State {
		collect("pet-bring-gift", { name: context.name, targets: context.nearbyAgents });
		return fromNodeState("succeeded");
	}

	function StealSpotlight(): State {
		collect("pet-steal-spotlight", { name: context.name, targets: context.nearbyAgents });
		return fromNodeState("succeeded");
	}

	function ComfortSadAgent(): State {
		collect("pet-comfort", { name: context.name, targets: context.nearbyAgents, morale: context.nearbyAgentMorale });
		return fromNodeState("succeeded");
	}

	function PickSide(): State {
		collect("pet-pick-side", { name: context.name, targets: context.nearbyAgents });
		return fromNodeState("succeeded");
	}

	const agent: PetBTObject = {
		context,
		collectedActions,
		HasExitTarget, HasFollowTarget, FollowTimeElapsed,
		SleepChanceRoll, WanderChanceRoll,
		IsHungry, IsThirsty,
		HasNearbyAgents, HasSadNearbyAgent, CatalystChanceRoll,
		WalkToExit, FollowAgent, ReturnHome,
		Nap, PickWanderPoint, WalkToPoint,
		SeekFoodBowl, SeekWaterBowl, PetEat, PetDrink,
		Idle,
		DragToy, SitBetween, BringGift, StealSpotlight, ComfortSadAgent, PickSide,
	};

	const tree = createTree(PET_MASTER_MDSL, agent);

	// PetBTObject satisfies BtAgentBase (has collectedActions and context.name).
	// AgentBT.agent is typed as BtAgentBase so no cast is needed.
	return { tree, agent };
}
