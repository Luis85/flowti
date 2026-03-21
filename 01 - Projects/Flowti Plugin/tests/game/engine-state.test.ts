import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
	existsSync: vi.fn(),
}));

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
	restoreWorldState,
	restoreAgentState,
	flushWorldState,
	startPeriodicFlush,
} from "../../src/game/engine-state.js";
import type { StateSystems } from "../../src/game/engine-state.js";

// ── Helpers ──────────────────────────────────────────────────────────

function createMockSystems(): StateSystems {
	return {
		dayClock: {
			restore: vi.fn(),
			serialize: vi.fn(() => ({ cycle: 1 })),
		},
		worldAmbience: {
			restore: vi.fn(),
			serialize: vi.fn(() => ({ weather: "clear" })),
		},
		memory: {
			restore: vi.fn(),
			serialize: vi.fn(() => ({ agents: {} })),
		},
		relationship: {
			restore: vi.fn(),
			serialize: vi.fn(() => ({ pairs: [] })),
		},
		needs: {
			restore: vi.fn(),
			serialize: vi.fn(() => ({ needsData: {} })),
		},
		brain: {
			getAllEntries: vi.fn(() => new Map([
				["alice", { position: { x: 100.7, y: 200.3 }, state: "idle" }],
				["bob", { position: { x: 300.1, y: 400.9 }, state: "working" }],
			])),
		},
		registry: {
			getEntityRoom: vi.fn((id: string) => {
				const rooms: Record<string, string> = {
					alice: "office",
					bob: "hub",
					"cat-hub": "hub",
				};
				return rooms[id];
			}),
		},
		pets: [
			{
				entityId: "cat-hub",
				pos: { x: 150.5, y: 250.8 },
				getState: vi.fn(() => "idle"),
				getHunger: vi.fn(() => 65),
				getThirst: vi.fn(() => 72),
			},
		],
	} as unknown as StateSystems;
}

const VAULT = "/test/vault";
const VAR_DIR = "/test/vault/.flowti/var";

beforeEach(() => {
	vi.clearAllMocks();
});

// ── restoreWorldState ────────────────────────────────────────────────

describe("restoreWorldState", () => {
	it("returns loaded list when all files exist", () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockImplementation((path) => {
			const p = String(path);
			if (p.includes("world-clock")) return JSON.stringify({ cycle: 5 });
			if (p.includes("world-weather")) return JSON.stringify({ weather: "rain" });
			if (p.includes("world-memory")) return JSON.stringify({ agents: {} });
			if (p.includes("world-relationships")) return JSON.stringify({ pairs: [] });
			if (p.includes("world-positions")) return JSON.stringify({ positions: { alice: { x: 10, y: 20, scene: "hub", state: "idle" } } });
			return "{}";
		});

		const ctx = createMockSystems();
		const result = restoreWorldState(ctx, VAULT);

		expect(result.loaded).toEqual([
			"world-clock.json",
			"world-weather.json",
			"world-memory.json",
			"world-relationships.json",
			"world-positions.json",
		]);
		expect(result.skipped).toEqual([]);
		expect(ctx.dayClock.restore).toHaveBeenCalledWith({ cycle: 5 });
		expect(ctx.worldAmbience.restore).toHaveBeenCalledWith({ weather: "rain" });
		expect(ctx.memory.restore).toHaveBeenCalledWith({ agents: {} });
		expect(ctx.relationship.restore).toHaveBeenCalledWith({ pairs: [] });
	});

	it("returns savedPositions when positions file exists", () => {
		vi.mocked(existsSync).mockReturnValue(true);
		const posData = { alice: { x: 10, y: 20, scene: "hub", state: "idle" } };
		vi.mocked(readFileSync).mockImplementation((path) => {
			const p = String(path);
			if (p.includes("world-positions")) return JSON.stringify({ positions: posData });
			return "{}";
		});

		const ctx = createMockSystems();
		const result = restoreWorldState(ctx, VAULT);

		expect(result.savedPositions).toEqual(posData);
	});

	it("returns skipped list when files do not exist", () => {
		vi.mocked(existsSync).mockReturnValue(false);

		const ctx = createMockSystems();
		const result = restoreWorldState(ctx, VAULT);

		expect(result.loaded).toEqual([]);
		expect(result.skipped).toEqual([
			"world-clock.json",
			"world-weather.json",
			"world-memory.json",
			"world-relationships.json",
			"world-positions.json",
		]);
		expect(result.savedPositions).toBeNull();
	});

	it("handles missing files gracefully — no throw", () => {
		vi.mocked(existsSync).mockImplementation(() => {
			throw new Error("disk error");
		});

		const ctx = createMockSystems();
		const result = restoreWorldState(ctx, VAULT);

		expect(result.loaded).toEqual([]);
		expect(result.skipped).toEqual([]);
		expect(result.savedPositions).toBeNull();
	});
});

// ── restoreAgentState ────────────────────────────────────────────────

describe("restoreAgentState", () => {
	it("loads needs data when file exists", () => {
		const needsData = { alice: { energy: 80, focus: 70, social: 60, morale: 90 } };
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(needsData));

		const ctx = createMockSystems();
		restoreAgentState(ctx, VAULT);

		expect(ctx.needs.restore).toHaveBeenCalledWith(needsData);
	});

	it("does nothing when needs file is missing", () => {
		vi.mocked(existsSync).mockReturnValue(false);

		const ctx = createMockSystems();
		restoreAgentState(ctx, VAULT);

		expect(ctx.needs.restore).not.toHaveBeenCalled();
	});

	it("handles errors gracefully", () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error("read error");
		});

		const ctx = createMockSystems();
		expect(() => restoreAgentState(ctx, VAULT)).not.toThrow();
	});
});

// ── flushWorldState ──────────────────────────────────────────────────

describe("flushWorldState", () => {
	it("calls writeFileSync for all 6 files", () => {
		vi.mocked(existsSync).mockReturnValue(true);

		const ctx = createMockSystems();
		flushWorldState(ctx, VAULT);

		expect(writeFileSync).toHaveBeenCalledTimes(6);

		const writtenPaths = vi.mocked(writeFileSync).mock.calls.map(
			(call) => String(call[0]).replace(/\\/g, "/"),
		);

		expect(writtenPaths).toContain(`${VAR_DIR}/world-clock.json`);
		expect(writtenPaths).toContain(`${VAR_DIR}/world-weather.json`);
		expect(writtenPaths).toContain(`${VAR_DIR}/world-memory.json`);
		expect(writtenPaths).toContain(`${VAR_DIR}/world-relationships.json`);
		expect(writtenPaths).toContain(`${VAR_DIR}/world-needs.json`);
		expect(writtenPaths).toContain(`${VAR_DIR}/world-positions.json`);
	});

	it("creates var directory if missing", () => {
		vi.mocked(existsSync).mockReturnValue(false);

		const ctx = createMockSystems();
		flushWorldState(ctx, VAULT);

		expect(mkdirSync).toHaveBeenCalled();
	});

	it("includes agent and pet positions in world-positions.json", () => {
		vi.mocked(existsSync).mockReturnValue(true);

		const ctx = createMockSystems();
		flushWorldState(ctx, VAULT);

		const posCall = vi.mocked(writeFileSync).mock.calls.find(
			(call) => String(call[0]).includes("world-positions"),
		);
		expect(posCall).toBeDefined();
		const posData = JSON.parse(String(posCall![1]));

		expect(posData.positions.alice).toEqual({ x: 101, y: 200, scene: "office", state: "idle" });
		expect(posData.positions.bob).toEqual({ x: 300, y: 401, scene: "hub", state: "working" });
		expect(posData.positions["cat-hub"]).toEqual({ x: 151, y: 251, scene: "hub", state: "idle", hunger: 65, thirst: 72 });
		expect(posData.updatedAt).toBeDefined();
	});

	it("handles write errors gracefully", () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error("disk full");
		});

		const ctx = createMockSystems();
		expect(() => flushWorldState(ctx, VAULT)).not.toThrow();
	});
});

// ── startPeriodicFlush ───────────────────────────────────────────────

describe("startPeriodicFlush", () => {
	it("registers a postupdate handler on the engine", () => {
		const ctx = createMockSystems();
		const engine = { on: vi.fn(), off: vi.fn() };

		startPeriodicFlush(ctx, VAULT, engine as unknown as Parameters<typeof startPeriodicFlush>[2]);

		expect(engine.on).toHaveBeenCalledWith("postupdate", expect.any(Function));
	});

	it("returns a cancel function that removes the handler", () => {
		const ctx = createMockSystems();
		const engine = { on: vi.fn(), off: vi.fn() };

		const cancel = startPeriodicFlush(ctx, VAULT, engine as unknown as Parameters<typeof startPeriodicFlush>[2]);
		cancel();

		expect(engine.off).toHaveBeenCalledWith("postupdate", expect.any(Function));
	});

	it("flushes positions after accumulated elapsed exceeds interval", () => {
		vi.mocked(existsSync).mockReturnValue(true);

		const ctx = createMockSystems();
		const engine = { on: vi.fn(), off: vi.fn() };

		startPeriodicFlush(ctx, VAULT, engine as unknown as Parameters<typeof startPeriodicFlush>[2]);

		const handler = engine.on.mock.calls[0][1] as (evt: { elapsed: number }) => void;

		// Simulate postupdate events — not yet at threshold
		handler({ elapsed: 2000 });
		expect(writeFileSync).not.toHaveBeenCalled();

		handler({ elapsed: 2000 });
		expect(writeFileSync).not.toHaveBeenCalled();

		// This pushes past 5000ms
		handler({ elapsed: 1500 });
		expect(writeFileSync).toHaveBeenCalledTimes(1);

		const writtenPath = String(vi.mocked(writeFileSync).mock.calls[0][0]).replace(/\\/g, "/");
		expect(writtenPath).toContain("world-positions.json");
	});
});
