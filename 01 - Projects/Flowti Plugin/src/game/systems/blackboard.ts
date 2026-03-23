/**
 * blackboard.ts — Per-agent data store for the AI pipeline.
 *
 * The blackboard is the single data bus between all agent systems:
 *   Sensors write → Blackboard ← BT writes intent/commands
 *                       ↓ push
 *               ECS Components (on Actor)
 *                       ↓ per-frame
 *               LocomotionSystem
 *                       ↓ pull
 *                   Blackboard
 *                       ↓ read
 *               Presentation (talk, bubbles, emotes)
 *
 * No system calls another system directly. All communication
 * flows through the blackboard.
 */

/** Bubble visual kind — inlined to avoid coupling blackboard to talk subsystem. */
export type BubbleKind = "speech" | "thought" | "question";

// ── Agent Needs ──────────────────────────────────────────────────

export interface AgentNeeds {
	energy: number;
	social: number;
	focus: number;
	morale: number;
	hunger: number;
	thirst: number;
}

// ── Agent Blackboard ─────────────────────────────────────────────

export interface AgentBlackboard {
	// ── Written by BT, read by locomotion ────────────
	movementCommand: "none" | "walk-to" | "wander";
	movementTarget: { x: number; y: number } | null;

	// ── Written by BT, read by presentation ──────────
	intent: "idle" | "working" | "talking" | "waiting" | "on-break" | "seeking";
	intentDetail: string;

	// ── Written by locomotion, read by BT ────────────
	arrived: boolean;
	position: { x: number; y: number };
	isMoving: boolean;

	// ── Written by sensors, read by BT ───────────────
	needs: AgentNeeds;
	nearbyAgents: string[];
	nearbyEntities: string[];
	currentRoom: string;
	nearestFoodStation: { x: number; y: number } | null;
	nearestDrinkStation: { x: number; y: number } | null;
	nearestRestStation: { x: number; y: number } | null;
	nearestWorkstation: { x: number; y: number } | null;

	// ── Written by echo/social, read by BT ───────────
	wanderHint: { x: number; y: number } | null;
	cascadeHint: string | null;
	cascadeTarget: { x: number; y: number } | null;
	roomAvoidance: string | null;
	breakThresholdBias: number;

	// ── Written by BT, read by presentation ──────────
	speechRequest: { text: string; kind: BubbleKind } | null;
}

// ── Defaults ─────────────────────────────────────────────────────

export function createDefaultBlackboard(): AgentBlackboard {
	return {
		movementCommand: "none",
		movementTarget: null,
		intent: "idle",
		intentDetail: "",
		arrived: false,
		position: { x: 0, y: 0 },
		isMoving: false,
		needs: { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 },
		nearbyAgents: [],
		nearbyEntities: [],
		currentRoom: "",
		nearestFoodStation: null,
		nearestDrinkStation: null,
		nearestRestStation: null,
		nearestWorkstation: null,
		wanderHint: null,
		cascadeHint: null,
		cascadeTarget: null,
		roomAvoidance: null,
		breakThresholdBias: 0,
		speechRequest: null,
	};
}

// ── Push/pull data interfaces ────────────────────────────────────
// Minimal shapes for sync — avoids importing Excalibur in tests.

export interface MovementComponentData {
	command: "none" | "walk-to" | "wander";
	target: { x: number; y: number } | null;
	arrived: boolean;
}

export interface IntentComponentData {
	intent: string;
	detail: string;
}

export interface SyncableActor {
	pos: { x: number; y: number };
	movementComponent?: MovementComponentData;
	intentComponent?: IntentComponentData;
}

// ── BlackboardManager ────────────────────────────────────────────

export class BlackboardManager {
	private readonly boards = new Map<string, AgentBlackboard>();

	/** Register an agent and create its blackboard. Idempotent. */
	register(name: string): void {
		if (this.boards.has(name)) return;
		this.boards.set(name, createDefaultBlackboard());
	}

	/** Remove an agent's blackboard. */
	unregister(name: string): void {
		this.boards.delete(name);
	}

	/** Get an agent's blackboard. Throws if not registered. */
	get(name: string): AgentBlackboard {
		const bb = this.boards.get(name);
		if (!bb) throw new Error(`No blackboard for agent "${name}"`);
		return bb;
	}

	/** Check if an agent is registered. */
	has(name: string): boolean {
		return this.boards.has(name);
	}

	/** Read-only access to all blackboards (for store adapter / postframe). */
	getAll(): ReadonlyMap<string, AgentBlackboard> {
		return this.boards;
	}

	/** Number of registered agents. */
	get size(): number {
		return this.boards.size;
	}

	/**
	 * Sync blackboard intent/commands → ECS components on actors.
	 * Called once per frame BEFORE locomotion runs.
	 */
	push(getActor: (name: string) => SyncableActor | undefined): void {
		for (const [name, bb] of this.boards) {
			const actor = getActor(name);
			if (!actor) continue;
			if (actor.movementComponent) {
				actor.movementComponent.command = bb.movementCommand;
				actor.movementComponent.target = bb.movementTarget;
			}
			if (actor.intentComponent) {
				actor.intentComponent.intent = bb.intent;
				actor.intentComponent.detail = bb.intentDetail;
			}
		}
	}

	/**
	 * Sync ECS component physical state → blackboard.
	 * Called once per frame AFTER locomotion runs.
	 */
	pull(getActor: (name: string) => SyncableActor | undefined): void {
		for (const [name, bb] of this.boards) {
			const actor = getActor(name);
			if (!actor) continue;
			bb.position = { x: actor.pos.x, y: actor.pos.y };
			if (actor.movementComponent) {
				bb.arrived = actor.movementComponent.arrived;
				bb.isMoving = actor.movementComponent.command !== "none";
			}
		}
	}
}
