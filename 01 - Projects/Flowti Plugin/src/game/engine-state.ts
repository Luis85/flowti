/**
 * engine-state.ts — Unified state persistence for the game engine.
 * Two-phase restore + flush + periodic position flush.
 *
 * Phase 1 (restoreWorldState): loads clock, weather, memory, relationships,
 *   and positions from `.flowti/var/` before the data provider starts.
 * Phase 2 (restoreAgentState): loads needs after agent registration so that
 *   defaults are set first, then overridden by persisted values.
 * Flush (flushWorldState): serialises all six JSON files on shutdown.
 * Periodic flush (startPeriodicFlush): writes positions every ~5 seconds
 *   via the engine's postupdate event — no setInterval.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { EngineContext } from "./engine-types.js";
import { POSITION_FLUSH_INTERVAL } from "./engine-config.js";
import { DEFAULT_ROOM } from "./data/scene-configs.js";
import type { IEchoStore } from "./systems/echo/echo-types.js";
import type { Echo } from "./systems/echo/echo-types.js";

// ── Minimal engine interface for postupdate wiring ───────────────────
// Avoids importing the full excalibur module at the type level.

interface PostUpdateEvent {
	elapsed: number;
}

interface GameEngine {
	on(eventName: "postupdate", handler: (evt: PostUpdateEvent) => void): void;
	off(eventName: string, handler: (...args: unknown[]) => void): void;
}

// ── Position record shape ────────────────────────────────────────────

export interface SavedPosition {
	x: number;
	y: number;
	scene: string;
	state: string;
	hunger?: number;
	thirst?: number;
}

// ── Phase 1 restore result ───────────────────────────────────────────

export interface RestoreResult {
	loaded: string[];
	skipped: string[];
	savedPositions: Record<string, SavedPosition> | null;
	/** Raw lastUpdated timestamp from persisted clock — used for offline progress. */
	clockLastUpdated: number | null;
}

// ── State persistence subset ─────────────────────────────────────────
// Narrow interface so callers don't need the full EngineContext.

export interface StateSystems {
	readonly dayClock: EngineContext["systems"]["dayClock"];
	readonly worldAmbience: EngineContext["systems"]["worldAmbience"];
	readonly memory: EngineContext["systems"]["memory"];
	readonly relationship: EngineContext["systems"]["relationship"];
	readonly needs: EngineContext["systems"]["needs"];
	readonly blackboards: EngineContext["systems"]["blackboards"];
	readonly registry: EngineContext["systems"]["registry"];
	readonly pets: EngineContext["pets"];
	readonly echo: IEchoStore;
}

// ── Helpers ──────────────────────────────────────────────────────────

function varDir(vaultPath: string): string {
	return join(vaultPath, ".flowti", "var");
}

function loadJson(path: string): unknown | null {
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf-8"));
}

function saveJson(path: string, data: unknown): void {
	writeFileSync(path, JSON.stringify(data, null, "\t"), "utf-8");
}

// ── Phase 1: Restore world state (before provider.start) ────────────

export function restoreWorldState(ctx: StateSystems, vaultPath: string): RestoreResult {
	const loaded: string[] = [];
	const skipped: string[] = [];
	let savedPositions: Record<string, SavedPosition> | null = null;
	let clockLastUpdated: number | null = null;

	try {
		const dir = varDir(vaultPath);

		const clockPath = join(dir, "world-clock.json");
		const clockData = loadJson(clockPath) as { lastUpdated?: number } | null;
		if (clockData) {
			clockLastUpdated = clockData.lastUpdated ?? null;
			ctx.dayClock.restore(clockData as Parameters<typeof ctx.dayClock.restore>[0]);
			loaded.push("world-clock.json");
		} else { skipped.push("world-clock.json"); }

		const weatherPath = join(dir, "world-weather.json");
		const weatherData = loadJson(weatherPath);
		if (weatherData) { ctx.worldAmbience.restore(weatherData as Parameters<typeof ctx.worldAmbience.restore>[0]); loaded.push("world-weather.json"); }
		else { skipped.push("world-weather.json"); }

		const memoryPath = join(dir, "world-memory.json");
		const memoryData = loadJson(memoryPath);
		if (memoryData) { ctx.memory.restore(memoryData as Parameters<typeof ctx.memory.restore>[0]); loaded.push("world-memory.json"); }
		else { skipped.push("world-memory.json"); }

		const relPath = join(dir, "world-relationships.json");
		const relData = loadJson(relPath);
		if (relData) { ctx.relationship.restore(relData as Parameters<typeof ctx.relationship.restore>[0]); loaded.push("world-relationships.json"); }
		else { skipped.push("world-relationships.json"); }

		const posPath = join(dir, "world-positions.json");
		const posData = loadJson(posPath) as { positions?: Record<string, SavedPosition> } | null;
		if (posData?.positions) { savedPositions = posData.positions; loaded.push("world-positions.json"); }
		else { skipped.push("world-positions.json"); }

		const echoPath = join(dir, "world-echoes.json");
		const echoData = loadJson(echoPath) as Record<string, Echo[]> | null;
		if (echoData) { ctx.echo.restore(echoData); loaded.push("world-echoes.json"); }
		else { skipped.push("world-echoes.json"); }
	} catch {
		// non-critical — start fresh
	}

	return { loaded, skipped, savedPositions, clockLastUpdated };
}

// ── Phase 2: Restore agent state (after registration) ────────────────

export function restoreAgentState(ctx: StateSystems, vaultPath: string): void {
	try {
		const needsPath = join(varDir(vaultPath), "world-needs.json");
		const needsData = loadJson(needsPath);
		if (needsData) ctx.needs.restore(needsData as Parameters<typeof ctx.needs.restore>[0]);
	} catch {
		// non-critical
	}
}

// ── Flush: Save all state to disk ────────────────────────────────────

function collectPositions(ctx: StateSystems): Record<string, SavedPosition> {
	const positions: Record<string, SavedPosition> = {};
	for (const [name, bb] of ctx.blackboards.getAll()) {
		positions[name] = {
			x: Math.round(bb.position.x),
			y: Math.round(bb.position.y),
			scene: ctx.registry.getEntityRoom(name) ?? DEFAULT_ROOM,
			state: bb.intent,
		};
	}
	for (const pet of ctx.pets) {
		positions[pet.entityId] = {
			x: Math.round(pet.pos.x),
			y: Math.round(pet.pos.y),
			scene: ctx.registry.getEntityRoom(pet.entityId) ?? DEFAULT_ROOM,
			state: pet.getState(),
			hunger: Math.round(pet.getHunger()),
			thirst: Math.round(pet.getThirst()),
		};
	}
	return positions;
}

export function flushWorldState(ctx: StateSystems, vaultPath: string): void {
	try {
		const dir = varDir(vaultPath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		saveJson(join(dir, "world-clock.json"), ctx.dayClock.serialize());
		saveJson(join(dir, "world-weather.json"), ctx.worldAmbience.serialize());
		saveJson(join(dir, "world-memory.json"), ctx.memory.serialize());
		saveJson(join(dir, "world-relationships.json"), ctx.relationship.serialize());
		saveJson(join(dir, "world-needs.json"), ctx.needs.serialize());

		const positions = collectPositions(ctx);
		saveJson(join(dir, "world-positions.json"), { updatedAt: new Date().toISOString(), positions });
		saveJson(join(dir, "world-echoes.json"), ctx.echo.serialize());
	} catch {
		// non-critical — skip silently
	}
}

// ── Periodic position flush via postupdate ───────────────────────────

export function startPeriodicFlush(ctx: StateSystems, vaultPath: string, engine: GameEngine): () => void {
	let timer = 0;
	const dir = varDir(vaultPath);
	const positionsPath = join(dir, "world-positions.json");

	const handler = (evt: PostUpdateEvent) => {
		timer += evt.elapsed;
		if (timer < POSITION_FLUSH_INTERVAL) return;
		timer = 0;

		const positions = collectPositions(ctx);
		try {
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
			saveJson(positionsPath, { updatedAt: new Date().toISOString(), positions });
		} catch {
			// Non-critical — skip silently
		}
	};

	engine.on("postupdate", handler);

	return () => {
		engine.off("postupdate", handler as (...args: unknown[]) => void);
	};
}
