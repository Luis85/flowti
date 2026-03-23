/**
 * camera-system.ts — Follow mode, zoom, and pan.
 *
 * Uses ExcaliburJS LockCameraToActorStrategy for follow,
 * camera.zoom for scroll zoom, and WASD/arrow keys for panning.
 * The HTML HUD overlay is handled by <camera-hud> (Lit component).
 */

import * as ex from "excalibur";
import type { AgentActor } from "../actors/agent-actor.js";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_LERP_FACTOR = 0.05;
const PAN_SPEED = 300; // pixels per second at zoom 1

export interface CameraSystem {
	startFollow(actor: AgentActor): void;
	stopFollow(): void;
	isFollowing(): boolean;
	getFollowedName(): string | null;
	checkDespawn(): void;
	onSceneActivate(findActor: (name: string) => AgentActor | undefined, sceneCamera: ex.Camera): void;
	setPanelOffset(offset: number): void;
	handleZoom(wheelDelta: number): void;
	applyZoom(deltaMs: number): void;
	updatePan(deltaMs: number): void;
	handleKeyDown(key: string): void;
	handleKeyUp(key: string): void;
}

export class OffsetFollowStrategy implements ex.CameraStrategy<ex.Actor> {
	constructor(public target: ex.Actor, public offset: number) {}
	action = (target: ex.Actor, _cam: ex.Camera, _eng: ex.Engine, _elapsed: number): ex.Vector => {
		const center = target.center;
		return new ex.Vector(center.x - this.offset, center.y);
	};
}

export function createCameraSystem(
	initialCamera: ex.Camera,
	sceneCenter: { x: number; y: number },
): CameraSystem {
	let camera = initialCamera;
	let followedActor: AgentActor | null = null;
	let followedName: string | null = null;
	let panelOffset = 0;
	let targetZoom = camera.zoom;
	const center = sceneCenter;

	// Keyboard pan state
	const keysHeld = new Set<string>();

	function resetToCenter(): void {
		void camera.move(ex.vec(center.x, center.y), 300, ex.EasingFunctions.EaseInOutCubic);
	}

	function startFollow(actor: AgentActor): void {
		followedActor = actor;
		followedName = actor.agentData.name;
		camera.clearAllStrategies();
		if (panelOffset > 0) {
			camera.addStrategy(new OffsetFollowStrategy(actor, panelOffset));
		} else {
			camera.addStrategy(new ex.LockCameraToActorStrategy(actor));
		}
	}

	function stopFollow(): void {
		followedActor = null;
		followedName = null;
		camera.clearAllStrategies();
		resetToCenter();
	}

	function checkDespawn(): void {
		if (followedActor && followedActor.isKilled()) {
			stopFollow();
		}
	}

	function onSceneActivate(findActor: (name: string) => AgentActor | undefined, sceneCamera: ex.Camera): void {
		camera = sceneCamera;
		targetZoom = camera.zoom;

		if (!followedName) return;
		const actor = findActor(followedName);
		if (actor) {
			startFollow(actor);
		} else {
			stopFollow();
		}
	}

	function setPanelOffset(offset: number): void {
		panelOffset = offset;
		if (followedActor) {
			camera.clearAllStrategies();
			if (offset > 0) {
				camera.addStrategy(new OffsetFollowStrategy(followedActor, offset));
			} else {
				camera.addStrategy(new ex.LockCameraToActorStrategy(followedActor));
			}
		}
	}

	function handleZoom(wheelDelta: number): void {
		const direction = wheelDelta > 0 ? -1 : 1;
		targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom + direction * ZOOM_STEP));
	}

	function applyZoom(deltaMs: number): void {
		const factor = 1 - Math.pow(ZOOM_LERP_FACTOR, deltaMs / 1000);
		camera.zoom += (targetZoom - camera.zoom) * factor;
	}

	function handleKeyDown(key: string): void {
		keysHeld.add(key);
	}

	function handleKeyUp(key: string): void {
		keysHeld.delete(key);
	}

	function updatePan(deltaMs: number): void {
		// Don't pan while following
		if (followedActor) return;
		if (keysHeld.size === 0) return;

		const speed = (PAN_SPEED / camera.zoom) * (deltaMs / 1000);
		let dx = 0;
		let dy = 0;
		if (keysHeld.has("ArrowLeft") || keysHeld.has("a")) dx -= speed;
		if (keysHeld.has("ArrowRight") || keysHeld.has("d")) dx += speed;
		if (keysHeld.has("ArrowUp") || keysHeld.has("w")) dy -= speed;
		if (keysHeld.has("ArrowDown") || keysHeld.has("s")) dy += speed;

		if (dx !== 0 || dy !== 0) {
			camera.pos.x += dx;
			camera.pos.y += dy;
		}
	}

	return {
		startFollow,
		stopFollow,
		isFollowing: () => followedActor !== null,
		getFollowedName: () => followedName,
		checkDespawn,
		onSceneActivate,
		setPanelOffset,
		handleZoom,
		applyZoom,
		updatePan,
		handleKeyDown,
		handleKeyUp,
	};
}
