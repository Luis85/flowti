/**
 * camera-system.ts — Follow mode, zoom, and HUD indicator.
 *
 * Uses ExcaliburJS LockCameraToActorStrategy for follow,
 * camera.zoom for scroll zoom, and HTML overlay for HUD.
 */

import * as ex from "excalibur";
import type { AgentActor } from "../actors/agent-actor.js";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_LERP_FACTOR = 0.05;

export interface CameraSystem {
	startFollow(actor: AgentActor): void;
	stopFollow(): void;
	isFollowing(): boolean;
	getFollowedName(): string | null;
	checkDespawn(): void;
	onSceneActivate(findActor: (name: string) => AgentActor | undefined, sceneCamera: ex.Camera): void;
	handleZoom(wheelDelta: number): void;
	applyZoom(deltaMs: number): void;
}

export function createCameraSystem(
	initialCamera: ex.Camera,
	hudContainer: HTMLElement,
): CameraSystem {
	let camera = initialCamera;
	let followedActor: AgentActor | null = null;
	let followedName: string | null = null;
	let hudEl: HTMLElement | null = null;
	let targetZoom = camera.zoom;

	function showHud(name: string): void {
		hideHud();
		if (typeof document === "undefined") return;
		const el = document.createElement("div");
		el.className = "follow-hud";
		el.style.cssText = "position:absolute;top:8px;left:50%;transform:translateX(-50%);" +
			"background:#1e293b;color:#e2e8f0;padding:4px 12px;border-radius:6px;" +
			"font:12px system-ui,sans-serif;display:flex;align-items:center;gap:8px;z-index:100;";
		el.innerHTML = `<span>Following: ${name}</span>`;
		const closeBtn = document.createElement("button");
		closeBtn.textContent = "\u00d7";
		closeBtn.style.cssText = "background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:0 2px;";
		closeBtn.onclick = () => stopFollow();
		el.appendChild(closeBtn);
		hudContainer.appendChild(el);
		hudEl = el;
	}

	function hideHud(): void {
		if (hudEl && hudEl.parentElement) {
			hudEl.parentElement.removeChild(hudEl);
		}
		hudEl = null;
	}

	function startFollow(actor: AgentActor): void {
		stopFollow();
		followedActor = actor;
		followedName = actor.agentData.name;
		camera.clearAllStrategies();
		camera.addStrategy(new ex.LockCameraToActorStrategy(actor));
		showHud(followedName);
	}

	function stopFollow(): void {
		followedActor = null;
		followedName = null;
		camera.clearAllStrategies();
		hideHud();
	}

	function checkDespawn(): void {
		if (followedActor && followedActor.isKilled()) {
			stopFollow();
		}
	}

	function onSceneActivate(findActor: (name: string) => AgentActor | undefined, sceneCamera: ex.Camera): void {
		// Always update camera reference to the active scene's camera
		camera = sceneCamera;
		targetZoom = camera.zoom;

		if (!followedName) return;
		const actor = findActor(followedName);
		if (actor) {
			followedActor = actor;
			camera.clearAllStrategies();
			camera.addStrategy(new ex.LockCameraToActorStrategy(actor));
		} else {
			stopFollow();
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

	return {
		startFollow,
		stopFollow,
		isFollowing: () => followedActor !== null,
		getFollowedName: () => followedName,
		checkDespawn,
		onSceneActivate,
		handleZoom,
		applyZoom,
	};
}
