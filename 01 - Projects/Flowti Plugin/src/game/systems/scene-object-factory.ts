/**
 * scene-object-factory.ts — Creates all scene objects from declarative JSON config.
 *
 * Reads SceneObjectConfig entries, creates GenericInteractable actors,
 * resolves graphics from the registry, wires pointer events, and registers
 * everything in SceneRegistry.
 */

import * as ex from "excalibur";
import { GenericInteractable } from "../actors/generic-interactable.js";
import { validateSceneObjects, type SceneObjectConfig } from "../data/scene-object-schema.js";
import type { SceneRegistry } from "./scene-registry.js";

export interface SceneObjectFactoryDeps {
	readonly registry: SceneRegistry;
	readonly scenes: Record<string, { add(actor: ex.Actor): void }>;
	readonly engine: ex.Engine;
}

export function createAllSceneObjects(
	configs: SceneObjectConfig[],
	deps: SceneObjectFactoryDeps,
): ReadonlyMap<string, GenericInteractable> {
	const result = validateSceneObjects(configs);
	for (const err of result.errors) console.warn(`[scene-objects] ${err}`);

	const map = new Map<string, GenericInteractable>();

	for (const config of configs) {
		if (!config.id || !config.room) continue;

		const actor = new GenericInteractable(config);
		actor.pos = ex.vec(config.position.x, config.position.y);

		// Wire pointer events
		actor.on("pointerdown", () => {
			deps.engine.canvas.dispatchEvent(new CustomEvent("object-interact", {
				bubbles: true,
				detail: { objectId: config.id, objectType: config.type },
			}));
		});
		actor.on("pointerenter", () => {
			deps.engine.canvas.classList.add("ft-cursor-pointer");
			actor.setHovered(true);
			deps.engine.canvas.dispatchEvent(new CustomEvent("object-hover", {
				bubbles: true,
				detail: { objectId: config.id, objectType: config.type, hover: true },
			}));
		});
		actor.on("pointerleave", () => {
			deps.engine.canvas.classList.remove("ft-cursor-pointer");
			actor.setHovered(false);
			deps.engine.canvas.dispatchEvent(new CustomEvent("object-hover", {
				bubbles: true,
				detail: { objectId: config.id, objectType: config.type, hover: false },
			}));
		});

		// Register in scene registry
		deps.registry.registerObject(config.id, config.room, config.type, config.position);
		deps.registry.registerInteractable(config.id, actor);

		// Add to scene
		const scene = deps.scenes[config.room];
		if (scene) scene.add(actor);

		map.set(config.id, actor);
	}

	return map;
}
