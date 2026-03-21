/**
 * scene-registry.ts — Central source of truth for what's in which scene.
 *
 * Tracks entity room assignments, transit state, static object catalog,
 * and scene references. Replaces scattered maps in engine.ts.
 */

import type { SceneEntity } from "../data/scene-entity.js";

export interface ObjectEntry {
	readonly id: string;
	readonly room: string;
	readonly type: string;
	readonly position: { readonly x: number; readonly y: number };
}

export interface DoorConfig {
	readonly target: string;
	readonly label: string;
	readonly position: { readonly x: number; readonly y: number };
}

/** Minimal scene interface for registry — GameScene implements this. */
export interface SceneHandle {
	getDoors(): readonly DoorConfig[];
}

/** Scene transfer interface used by RoomSwitcher — GameScene implements both. */
export interface SceneTransition {
	exit(entityId: string): void;
	enter(entity: SceneEntity, fromScene: string | null): void;
}

interface TransitEntry {
	readonly target: string;
	readonly door: { readonly x: number; readonly y: number };
}

export class SceneRegistry {
	private readonly entityRooms = new Map<string, string>();
	private readonly transitState = new Map<string, TransitEntry>();
	private readonly objects: ObjectEntry[] = [];
	private readonly scenes = new Map<string, SceneHandle>();

	// ── Entity tracking ──────────────────────────────────

	getEntityRoom(id: string): string | undefined {
		return this.entityRooms.get(id);
	}

	setEntityRoom(id: string, room: string): void {
		this.entityRooms.set(id, room);
	}

	removeEntity(id: string): void {
		this.entityRooms.delete(id);
		this.transitState.delete(id);
	}

	getEntitiesInRoom(room: string): string[] {
		const result: string[] = [];
		for (const [id, r] of this.entityRooms) {
			if (r === room) result.push(id);
		}
		return result;
	}

	getAllEntityIds(): string[] {
		return [...this.entityRooms.keys()];
	}

	// ── Transit state ────────────────────────────────────

	setInTransit(id: string, target: string, door: { x: number; y: number }): void {
		this.transitState.set(id, { target, door });
	}

	clearTransit(id: string): void {
		this.transitState.delete(id);
	}

	isInTransit(id: string): boolean {
		return this.transitState.has(id);
	}

	getTransit(id: string): TransitEntry | undefined {
		return this.transitState.get(id);
	}

	getAllTransitIds(): string[] {
		return [...this.transitState.keys()];
	}

	// ── Object catalog ───────────────────────────────────

	registerObject(id: string, room: string, type: string, position: { x: number; y: number }): void {
		this.objects.push({ id, room, type, position: { x: position.x, y: position.y } });
	}

	findObject(type: string): ObjectEntry | undefined {
		return this.objects.find((o) => o.type === type);
	}

	findObjectsOfType(type: string): ObjectEntry[] {
		return this.objects.filter((o) => o.type === type);
	}

	getObjectsInRoom(room: string): ObjectEntry[] {
		return this.objects.filter((o) => o.room === room);
	}

	// ── Scene access ─────────────────────────────────────

	registerScene(id: string, scene: SceneHandle): void {
		this.scenes.set(id, scene);
	}

	getScene(id: string): SceneHandle | undefined {
		return this.scenes.get(id);
	}

	getAllSceneIds(): string[] {
		return [...this.scenes.keys()];
	}

	getDoorBetween(from: string, to: string): DoorConfig | undefined {
		const scene = this.scenes.get(from);
		if (!scene) return undefined;
		return scene.getDoors().find((d) => d.target === to);
	}
}
