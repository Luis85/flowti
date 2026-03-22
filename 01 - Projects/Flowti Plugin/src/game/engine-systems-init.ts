/**
 * engine-systems-init.ts — System initialization helpers for the game engine.
 *
 * Contains BT bridge factories and brain system callback configurations
 * extracted from engine.ts to reduce file length.
 */

import type { BrainSystem } from "./systems/brain-system.js";
import type { NeedsSystem } from "./systems/needs-system.js";
import { createStubDeps } from "./systems/bt-system.js";
import type { GameScene } from "./scenes/game-scene.js";
import type { SceneRegistry } from "./systems/scene-registry.js";
import { preferredWorkstation } from "./brain/movement.js";

// ── BT bridge types ─────────────────────────────────────────────

export interface BtWorldStateBridge {
	emitAction: (action: { id: string; agentName: string; timestamp: string; type: string; data: Record<string, unknown> }) => void;
	updateEntity: () => void;
}

export interface BtClockBridge {
	now: () => number;
	ms: () => number;
	iso: () => string;
}

/**
 * Creates the BT world state, clock, needs, and brain bridges used by
 * the behavior-tree system.
 */
export function createBtBridges(
	brainSystem: BrainSystem,
	needsSystem: NeedsSystem,
): {
	btWorldState: BtWorldStateBridge;
	btClock: BtClockBridge;
	btDeps: ReturnType<typeof createStubDeps>;
} {
	// Only intent actions go through the bridge to the brain. Seek actions
	// are applied directly by the BT action functions via deps.brain. Passive
	// actions (idle, chatter, file ops) are invisible to the brain — the
	// brain's autonomous idle→wander cycle handles movement pacing.
	const BT_INTENT_ACTIONS: ReadonlySet<string> = new Set([
		"thinking", "asking", "using-tool",
		"speaking", "error",
	]);
	const btWorldState: BtWorldStateBridge = {
		emitAction: (action) => {
			if (BT_INTENT_ACTIONS.has(action.type)) {
				brainSystem.applyEvent(action.agentName, action.type);
			}
		},
		updateEntity: () => {},
	};
	const btClock: BtClockBridge = {
		now: () => Date.now(),
		ms: () => Date.now(),
		iso: () => new Date().toISOString(),
	};
	const btNeedsBridge = {
		getNeeds: (name: string) => needsSystem.getNeeds(name),
	};
	const btBrainBridge = {
		assignWork: (name: string) => brainSystem.assignWork(name),
		releaseWork: (name: string) => brainSystem.releaseWork(name),
		applyEvent: (name: string, event: string) => brainSystem.applyEvent(name, event),
		getState: (name: string) => {
			const state = brainSystem.getState(name);
			return state?.state ?? "idle";
		},
	};
	const btDeps = createStubDeps(btWorldState, btClock, btNeedsBridge, btBrainBridge);
	return { btWorldState, btClock, btDeps };
}

export interface BrainCallbackDeps {
	roomScenes: Record<string, GameScene>;
}

/**
 * Creates the `onWorkstationChange` callback for BrainSystem.
 */
export function createWorkstationChangeCallback(
	deps: BrainCallbackDeps,
): (agentName: string, action: string, position: { x: number; y: number }) => void {
	return (agentName, action, position) => {
		for (const room of Object.values(deps.roomScenes)) {
			const actor = room.getAgentActor(agentName);
			if (!actor) continue;

			if (action === "occupy") {
				const workstations = room.getWorkstations();
				let nearest = workstations[0];
				let minDist = Infinity;
				for (const ws of workstations) {
					const dx = ws.pos.x - position.x;
					const dy = ws.pos.y - position.y;
					const dist = dx * dx + dy * dy;
					if (dist < minDist && !ws.occupied) {
						minDist = dist;
						nearest = ws;
					}
				}
				if (nearest && !nearest.occupied) {
					nearest.occupy(agentName);
				}
			} else {
				const workstations = room.getWorkstations();
				const ws = workstations.find((w) => w.occupantName === agentName);
				if (ws) ws.vacate();
			}
			break;
		}
	};
}

/**
 * Creates the `onWorkstationResolve` callback for BrainSystem.
 */
export function createWorkstationResolveCallback(
	deps: BrainCallbackDeps,
): (agentName: string, preferredId: string | undefined) => { x: number; y: number } | null {
	return (agentName, preferredId) => {
		for (const room of Object.values(deps.roomScenes)) {
			const actor = room.getAgentActor(agentName);
			if (!actor) continue;
			const workstations = room.getWorkstations().map((ws) => ({
				id: ws.workstationId, x: ws.pos.x, y: ws.pos.y, occupied: ws.occupied,
			}));
			return preferredWorkstation({ x: actor.pos.x, y: actor.pos.y }, workstations, preferredId);
		}
		return null;
	};
}

/**
 * Creates the `findNearestAgent` lookup function.
 * Returns position of the closest agent in the same room, or null.
 */
export function createFindNearestAgent(
	brainSystem: BrainSystem,
	registry: SceneRegistry,
): (agentName: string) => { x: number; y: number } | null {
	return (agentName: string) => {
		const pos = brainSystem.getPosition(agentName);
		if (!pos) return null;
		const myRoom = registry.getEntityRoom(agentName);
		let closest: { x: number; y: number } | null = null;
		let minDist = Infinity;
		for (const [name, entry] of brainSystem.getAllEntries()) {
			if (name === agentName) continue;
			if (registry.getEntityRoom(name) !== myRoom) continue;
			const dx = pos.x - entry.position.x;
			const dy = pos.y - entry.position.y;
			const dist = dx * dx + dy * dy;
			if (dist < minDist) {
				minDist = dist;
				closest = { x: entry.position.x, y: entry.position.y };
			}
		}
		return closest;
	};
}
