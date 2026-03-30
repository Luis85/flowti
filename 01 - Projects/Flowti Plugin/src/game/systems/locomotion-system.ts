/**
 * locomotion-system.ts — Per-frame movement executor for agents.
 *
 * Pure executor — no decisions, no timers, no autonomous transitions.
 * Reads MovementComponent data, moves actor toward target, detects arrival.
 * Also handles separation nudge between overlapping idle agents and
 * idle pose cycling for visual variety.
 *
 * The BT decides WHAT to do (via blackboard → push → MovementComponent).
 * The LocomotionSystem decides HOW to move (speed, direction, arrival).
 */

import { resolveIdleTarget, computeSeparation, type Bounds, type Position } from "../brain/movement.js";

// ── Constants ────────────────────────────────────────────────────

const ARRIVAL_THRESHOLD = 4;
const SPRITE_MARGIN = 16;

import { WORLD_CONFIG } from "../data/world-config.js";

const SPEED_MAP: Record<string, number> = WORLD_CONFIG.behavior.speedMap;

const IDLE_CYCLES: Record<string, readonly string[]> = {
	fidgety: ["idle", "look-around", "stretch", "idle"],
	calm: ["idle", "idle", "look-around", "idle"],
	restless: ["idle", "look-around", "idle", "look-around", "stretch"],
};

const IDLE_TIMERS: Record<string, { min: number; max: number }> = WORLD_CONFIG.behavior.idleTimers;

// ── Per-agent locomotion entry ───────────────────────────────────

export interface LocomotionEntry {
	// Movement state (synced from MovementComponent)
	command: "none" | "walk-to" | "wander";
	target: { x: number; y: number } | null;
	arrived: boolean;
	speed: number;
	movementStyle: "deliberate" | "brisk" | "darting";
	position: { x: number; y: number };
	// Personality for wander resolution
	socialDrift: number;
	focusDrift: number;
	// Idle pose cycling
	idleStyle: "fidgety" | "calm" | "restless";
	idlePoseTimer: number;
	idlePoseIndex: number;
	// Visual feedback urgency
	urgencySpeedBoost: number;
}

export function createLocomotionEntry(overrides: Partial<LocomotionEntry> = {}): LocomotionEntry {
	return {
		command: "none",
		target: null,
		arrived: false,
		speed: 40,
		movementStyle: "brisk",
		position: { x: 0, y: 0 },
		socialDrift: 0.3,
		focusDrift: 0.1,
		idleStyle: "restless",
		idlePoseTimer: 0,
		idlePoseIndex: 0,
		urgencySpeedBoost: 1.0,
		...overrides,
	};
}

// ── LocomotionSystem ─────────────────────────────────────────────

export class LocomotionSystem {
	private readonly bounds: Bounds;
	private readonly targetBounds: Bounds;

	constructor(bounds: Bounds) {
		this.bounds = bounds;
		this.targetBounds = {
			minX: bounds.minX + SPRITE_MARGIN,
			maxX: bounds.maxX - SPRITE_MARGIN,
			minY: bounds.minY + SPRITE_MARGIN,
			maxY: bounds.maxY - SPRITE_MARGIN,
		};
	}

	/** Process one agent's movement for this frame. */
	updateAgent(entry: LocomotionEntry, deltaMs: number, nearbyPositions: readonly Position[] = []): void {
		// Wander: resolve a random target, then walk to it
		if (entry.command === "wander") {
			const habits = { socialDrift: entry.socialDrift, focusDrift: entry.focusDrift };
			const dest = resolveIdleTarget(habits, nearbyPositions, this.targetBounds, Math.random, entry.position);
			if (dest) {
				entry.target = dest;
				entry.command = "walk-to";
			} else {
				entry.command = "none";
				return;
			}
		}

		// Walk-to: move toward target, detect arrival
		if (entry.command === "walk-to" && entry.target) {
			const dx = entry.target.x - entry.position.x;
			const dy = entry.target.y - entry.position.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < ARRIVAL_THRESHOLD) {
				entry.arrived = true;
				entry.command = "none";
				entry.target = null;
				return;
			}

			const speedMult = SPEED_MAP[entry.movementStyle] ?? 1.0;
			const urgencyBoost = entry.urgencySpeedBoost ?? 1.0;
			const speed = entry.speed * speedMult * urgencyBoost * (deltaMs / 1000);
			const move = Math.min(speed, dist);
			entry.position.x += (dx / dist) * move;
			entry.position.y += (dy / dist) * move;

			// Clamp to bounds
			entry.position.x = Math.max(this.targetBounds.minX, Math.min(this.targetBounds.maxX, entry.position.x));
			entry.position.y = Math.max(this.targetBounds.minY, Math.min(this.targetBounds.maxY, entry.position.y));
		}

		// Idle pose cycling
		if (entry.command === "none") {
			this.updateIdlePose(entry, deltaMs);
		}
	}

	/** Push overlapping idle agents apart. */
	applySeparation(entries: readonly LocomotionEntry[]): void {
		for (const entry of entries) {
			if (entry.command !== "none") continue;
			const others = entries
				.filter((e) => e !== entry)
				.map((e) => e.position);
			const nudged = computeSeparation(entry.position, others, this.targetBounds);
			entry.position.x = nudged.x;
			entry.position.y = nudged.y;
		}
	}

	private updateIdlePose(entry: LocomotionEntry, deltaMs: number): void {
		entry.idlePoseTimer += deltaMs;
		const timers = IDLE_TIMERS[entry.idleStyle] ?? IDLE_TIMERS.restless;
		const threshold = timers.min + Math.random() * (timers.max - timers.min);
		if (entry.idlePoseTimer < threshold) return;
		entry.idlePoseTimer = 0;
		const cycle = IDLE_CYCLES[entry.idleStyle] ?? IDLE_CYCLES.restless;
		entry.idlePoseIndex = (entry.idlePoseIndex + 1) % cycle.length;
	}
}
