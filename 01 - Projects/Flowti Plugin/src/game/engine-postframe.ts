/**
 * engine-postframe.ts — Post-frame adapter extracted from engine.ts.
 *
 * Pushes agent positions, targets, and states from the brain system
 * to the dashboard store after each engine frame.
 */

import * as ex from "excalibur";
import type { BrainSystem } from "./systems/brain-system.js";
import type { NeedsSystem } from "./systems/needs-system.js";
import type { DashboardStore, Point } from "./store/dashboard-store.js";
import type { AgentActor } from "./actors/agent-actor.js";

export interface PostframeDeps {
	engine: ex.Engine;
	store: DashboardStore;
	brainSystem: BrainSystem;
	needsSystem: NeedsSystem;
	findCurrentSceneActor: (name: string) => AgentActor | undefined;
}

/**
 * Creates the postframe handler that syncs brain state to the store.
 * Returns the handler function for `engine.on("postframe", handler)`.
 */
export function createPostframeHandler(deps: PostframeDeps): () => void {
	const { engine, store, brainSystem, needsSystem, findCurrentSceneActor } = deps;

	return () => {
		store.beginBatch();
		const positions = new Map<string, Point>();
		const canvasRect = engine.canvas.getBoundingClientRect();

		for (const [name, entry] of brainSystem.getAllEntries()) {
			const actor = findCurrentSceneActor(name);
			if (!actor) continue;
			const pagePos = engine.screen.worldToPageCoordinates(actor.pos);
			positions.set(name, { x: pagePos.x - canvasRect.left, y: pagePos.y - canvasRect.top });

			if (entry.targetPos) {
				const targetPage = engine.screen.worldToPageCoordinates(ex.vec(entry.targetPos.x, entry.targetPos.y));
				store.setAgentTarget(name, {
					x: targetPage.x - canvasRect.left,
					y: targetPage.y - canvasRect.top,
				});
			} else {
				store.clearAgentTarget(name);
			}
			store.setAgentState(name, entry.state);
		}

		// Push agent needs to store for UI consumption
		for (const agentName of needsSystem.getAgentNames()) {
			store.setAgentNeeds(agentName, needsSystem.getNeeds(agentName));
		}

		store.updatePositions(positions);
		store.endBatch();
	};
}
