/**
 * room-switcher.ts — Unified room transfer system for agents and creatures.
 *
 * Handles both explore (random) and purpose (need-driven) room switches.
 * Manages the full walk-to-door → exit → enter lifecycle for all entity types.
 */

import type { SceneRegistry, DoorConfig, SceneTransition } from "./scene-registry.js";
import type { SceneEntity } from "../data/scene-entity.js";

export interface TransferRequest {
	readonly entityId: string;
	readonly targetRoom: string;
	readonly reason: "explore" | "purpose";
	readonly targetObject?: string;
}

export interface RoomSwitcherConfig {
	readonly registry: SceneRegistry;
	readonly getEntity: (id: string) => SceneEntity | undefined;
	readonly getEntityState: (id: string) => string;
	readonly isTaskLocked: (id: string) => boolean;
	readonly onTransferComplete?: (entityId: string, fromRoom: string, toRoom: string, reason: string) => void;
}

function isSceneTransition(s: unknown): s is SceneTransition {
	return s !== null && typeof s === "object" && "exit" in s && "enter" in s;
}

const AGENT_SWITCH_INTERVAL = 10_000;
const AGENT_SWITCH_CHANCE = 0.08;
const CREATURE_SWITCH_INTERVAL = 8_000;
const CREATURE_SWITCH_CHANCE = 0.25;
const DOOR_ARRIVAL_DIST_SQ = 70 * 70;

export class RoomSwitcher {
	private readonly config: RoomSwitcherConfig;
	private agentTimer = 0;
	private creatureTimer = 0;
	private readonly pendingHops = new Map<string, TransferRequest>();
	private readonly hopCooldowns = new Map<string, number>();

	constructor(config: RoomSwitcherConfig) {
		this.config = config;
	}

	requestTransfer(req: TransferRequest): void {
		const { registry } = this.config;
		const currentRoom = registry.getEntityRoom(req.entityId);
		if (!currentRoom || currentRoom === req.targetRoom) return;
		if (registry.isInTransit(req.entityId)) return;

		// Find door from current room to target
		let door: DoorConfig | undefined = registry.getDoorBetween(currentRoom, req.targetRoom);
		if (!door) {
			// No direct door — route through hub
			door = registry.getDoorBetween(currentRoom, "hub");
			if (!door) return;
			// Queue the second hop for after hub arrival
			this.pendingHops.set(req.entityId, req);
		}

		const targetForTransit = door.target === req.targetRoom ? req.targetRoom : "hub";
		registry.setInTransit(req.entityId, targetForTransit, door.position);
		const entity = this.config.getEntity(req.entityId);
		if (entity) entity.moveTo(door.position.x, door.position.y);
	}

	update(deltaMs: number): void {
		this.checkArrivals();
		this.tickHopCooldowns(deltaMs);
		this.tickExploreTimers(deltaMs);
	}

	private checkArrivals(): void {
		const { registry } = this.config;
		const transitIds = registry.getAllTransitIds();

		for (const entityId of transitIds) {
			const transit = registry.getTransit(entityId);
			if (!transit) continue;
			const entity = this.config.getEntity(entityId);
			if (!entity) { registry.clearTransit(entityId); continue; }

			const pos = entity.getPosition();
			const dx = pos.x - transit.door.x;
			const dy = pos.y - transit.door.y;

			if (dx * dx + dy * dy < DOOR_ARRIVAL_DIST_SQ) {
				this.executeTransfer(entityId, entity, transit.target);
			} else {
				// Not at door — re-walk if interrupted
				const state = this.config.getEntityState(entityId);
				if (entity.entityType === "creature") {
					// Pets use PetState "wandering" for both room roam and walking to a door.
					// Skipping moveTo while "wandering" strands them after wander timers retarget away from the door.
					if (state !== "exiting") {
						entity.moveTo(transit.door.x, transit.door.y);
					}
				} else if (state !== "walking-to" && state !== "exiting" && state !== "wandering") {
					entity.moveTo(transit.door.x, transit.door.y);
				}
			}
		}
	}

	private executeTransfer(entityId: string, entity: SceneEntity, targetRoom: string): void {
		const { registry } = this.config;
		const fromRoom = registry.getEntityRoom(entityId);
		if (!fromRoom) return;

		const fromScene = registry.getScene(fromRoom);
		const toScene = registry.getScene(targetRoom);
		if (!fromScene || !toScene) return;
		if (!isSceneTransition(fromScene) || !isSceneTransition(toScene)) return;

		// Exit current scene — GameScene.exit() handles actor cleanup
		fromScene.exit(entityId);

		// Enter target scene
		toScene.enter(entity, fromRoom);

		registry.setEntityRoom(entityId, targetRoom);
		registry.clearTransit(entityId);

		// Check for pending multi-hop
		const pendingHop = this.pendingHops.get(entityId);
		if (pendingHop && targetRoom !== pendingHop.targetRoom) {
			// We arrived at hub, queue cooldown before next hop
			this.hopCooldowns.set(entityId, 2000);
		} else {
			this.pendingHops.delete(entityId);
			// Post-arrival movement — walk into the room (same for agents and creatures)
			if (entity.entityType === "agent" && pendingHop?.targetObject) {
				const obj = registry.getObjectsInRoom(targetRoom).find((o) => o.id === pendingHop.targetObject);
				if (obj) entity.moveTo(obj.position.x, obj.position.y);
				else entity.moveTo(200 + Math.random() * 400, 150 + Math.random() * 200);
			} else {
				entity.moveTo(200 + Math.random() * 400, 150 + Math.random() * 200);
			}
		}

		this.config.onTransferComplete?.(entityId, fromRoom, targetRoom, "transfer");
	}

	private tickHopCooldowns(deltaMs: number): void {
		for (const [entityId, remaining] of this.hopCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) {
				this.hopCooldowns.delete(entityId);
				const pending = this.pendingHops.get(entityId);
				if (pending) {
					this.pendingHops.delete(entityId);
					this.requestTransfer(pending);
				}
			} else {
				this.hopCooldowns.set(entityId, updated);
			}
		}
	}

	private tickExploreTimers(deltaMs: number): void {
		this.agentTimer += deltaMs;
		this.creatureTimer += deltaMs;

		if (this.agentTimer >= AGENT_SWITCH_INTERVAL) {
			this.agentTimer = 0;
			this.tryExploreSwitch("agent", AGENT_SWITCH_CHANCE);
		}

		if (this.creatureTimer >= CREATURE_SWITCH_INTERVAL) {
			this.creatureTimer = 0;
			this.tryExploreSwitch("creature", CREATURE_SWITCH_CHANCE);
		}
	}

	private tryExploreSwitch(entityType: "agent" | "creature", chance: number): void {
		const { registry } = this.config;
		const allScenes = registry.getAllSceneIds();

		for (const entityId of registry.getAllEntityIds()) {
			const entity = this.config.getEntity(entityId);
			if (!entity || entity.entityType !== entityType) continue;
			if (registry.isInTransit(entityId)) continue;

			const state = this.config.getEntityState(entityId);
			if (state !== "idle" && state !== "wandering") continue;
			if (entityType === "agent" && this.config.isTaskLocked(entityId)) continue;
			if (Math.random() > chance) continue;

			const currentRoom = registry.getEntityRoom(entityId);
			if (!currentRoom) continue;

			const otherRooms = allScenes.filter((r) => r !== currentRoom);
			if (otherRooms.length === 0) continue;
			const targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];

			this.requestTransfer({ entityId, targetRoom, reason: "explore" });
		}
	}
}
