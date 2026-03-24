/**
 * scene-object-schema.ts — Types and validation for declarative scene object configs.
 *
 * Each entry in scene-objects.json describes one interactive environment object:
 * its room placement, visual, size, and needs-satisfaction effects.
 */

import { ROOM_IDS, type RoomId } from "./scene-configs.js";

export interface SceneObjectConfig {
	readonly id: string;
	readonly type: string;
	readonly room: RoomId;
	readonly position: { readonly x: number; readonly y: number };
	readonly size: { readonly width: number; readonly height: number };
	readonly interactionOffset?: { readonly x: number; readonly y: number };
	readonly needsEffects?: Partial<{
		energy: number;
		social: number;
		focus: number;
		morale: number;
		hunger: number;
		thirst: number;
	}>;
	readonly graphic?: string;
	readonly sprite?: string;
	readonly spriteRect?: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
}

export interface ValidationResult {
	readonly valid: boolean;
	readonly errors: string[];
}

export function validateSceneObjects(objects: unknown[]): ValidationResult {
	const errors: string[] = [];
	const ids = new Set<string>();
	const roomSet = new Set<string>(ROOM_IDS);

	for (let i = 0; i < objects.length; i++) {
		const o = objects[i] as Record<string, unknown>;
		const prefix = `objects[${i}]`;

		if (!o.id || typeof o.id !== "string") {
			errors.push(`${prefix}: missing or invalid id`);
			continue;
		}
		if (ids.has(o.id as string)) {
			errors.push(`${prefix}: duplicate id "${o.id}"`);
			continue;
		}
		ids.add(o.id as string);

		if (!o.room || !roomSet.has(o.room as string)) {
			errors.push(`${prefix} (${o.id}): invalid room "${o.room}"`);
		}
		if (!o.type || typeof o.type !== "string") {
			errors.push(`${prefix} (${o.id}): missing type`);
		}

		const size = o.size as Record<string, number> | undefined;
		if (!size || size.width <= 0 || size.height <= 0) {
			errors.push(`${prefix} (${o.id}): invalid size`);
		}

		const pos = o.position as Record<string, number> | undefined;
		if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
			errors.push(`${prefix} (${o.id}): invalid position`);
		}

		if (!o.graphic && !o.sprite) {
			errors.push(`${prefix} (${o.id}): must have graphic or sprite`);
		}
	}

	return { valid: errors.length === 0, errors };
}
