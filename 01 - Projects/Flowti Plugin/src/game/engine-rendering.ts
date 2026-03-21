/**
 * engine-rendering.ts — Rendering helpers extracted from engine.ts.
 *
 * Contains particle renderer and lighting overlay actor factories,
 * plus keyboard handler setup for the game engine.
 */

import * as ex from "excalibur";
import type { ParticlePool } from "./systems/particle-system.js";

/** Creates a particle renderer actor with a Canvas graphic. */
export function createParticleRenderer(
	particlePool: ParticlePool,
	engineWidth: number,
	engineHeight: number,
): ex.Actor {
	const actor = new ex.Actor({
		pos: ex.vec(0, 0),
		anchor: ex.vec(0, 0),
		z: 50,
		collisionType: ex.CollisionType.PreventCollision,
	});
	const canvas = new ex.Canvas({
		width: engineWidth,
		height: engineHeight,
		cache: false,
		draw: (ctx: CanvasRenderingContext2D) => {
			for (const p of particlePool.getAll()) {
				if (p.opacity <= 0.01) continue;
				ctx.globalAlpha = p.opacity;
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1.0;
		},
	});
	actor.graphics.use(canvas);
	return actor;
}

export interface LightState {
	r: number;
	g: number;
	b: number;
	opacity: number;
}

/** Creates a lighting overlay actor driven by the currentLight state. */
export function createLightingOverlay(
	currentLight: LightState,
	engineWidth: number,
	engineHeight: number,
): ex.Actor {
	const actor = new ex.Actor({
		pos: ex.vec(0, 0),
		anchor: ex.vec(0, 0),
		z: 500,
		collisionType: ex.CollisionType.PreventCollision,
	});
	const canvas = new ex.Canvas({
		width: engineWidth,
		height: engineHeight,
		cache: false,
		draw: (ctx: CanvasRenderingContext2D) => {
			if (currentLight.opacity <= 0.001) return;
			ctx.fillStyle = `rgba(${Math.round(currentLight.r)}, ${Math.round(currentLight.g)}, ${Math.round(currentLight.b)}, ${currentLight.opacity.toFixed(3)})`;
			ctx.fillRect(0, 0, engineWidth, engineHeight);
		},
	});
	actor.graphics.use(canvas);
	return actor;
}

/** Checks if the user is typing in an input/textarea (walking shadow DOM). */
export function isTypingInInput(): boolean {
	let el: Element | null = document.activeElement;
	while (el) {
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
		if (el.shadowRoot?.activeElement) {
			el = el.shadowRoot.activeElement;
		} else {
			break;
		}
	}
	return false;
}

export interface KeyboardHandlersDeps {
	cameraSystem: { isFollowing(): boolean; stopFollow(): void; handleKeyDown(key: string): void; handleKeyUp(key: string): void } | null;
	getCameraSystem: () => KeyboardHandlersDeps["cameraSystem"];
}

/**
 * Registers keyboard handlers on the document and returns a cleanup function.
 */
export function setupKeyboardHandlers(
	deps: KeyboardHandlersDeps,
): { keydownHandler: EventListener; keyupHandler: EventListener } {
	const keydownHandler = ((e: KeyboardEvent) => {
		if (isTypingInInput()) return;
		const cam = deps.getCameraSystem();
		if (e.key === "Escape" && cam?.isFollowing()) {
			cam.stopFollow();
		}
		if (e.key === "Home") {
			cam?.stopFollow();
		}
		cam?.handleKeyDown(e.key);
	}) as EventListener;

	const keyupHandler = ((e: KeyboardEvent) => {
		if (isTypingInInput()) return;
		deps.getCameraSystem()?.handleKeyUp(e.key);
	}) as EventListener;

	return { keydownHandler, keyupHandler };
}

/** Creates the loading overlay element shown during engine startup. */
export function createLoadingOverlay(): HTMLDivElement {
	const overlay = document.createElement("div");
	overlay.style.cssText = `
		position: absolute; inset: 0; z-index: 9999;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		background: #0a0a0f; color: #64748b; font-family: system-ui, sans-serif;
		transition: opacity 0.6s ease-out;
	`;
	overlay.innerHTML = `
		<div style="font-size: 14px; margin-bottom: 16px; color: #94a3b8;">Loading Agent World</div>
		<div style="width: 120px; height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden;">
			<div style="width: 30%; height: 100%; background: #3b82f6; border-radius: 2px; animation: loading-bar 1.2s ease-in-out infinite alternate;"></div>
		</div>
		<style>@keyframes loading-bar { from { width: 20%; margin-left: 0; } to { width: 40%; margin-left: 60%; } }</style>
	`;
	return overlay;
}
