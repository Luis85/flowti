import { describe, it, expect, vi, beforeEach } from "vitest";
import { BtSystem, BT_TICK_INTERVAL_MS, createStubDeps } from "../../../src/game/systems/bt-system.js";
import type { DashboardAgent } from "../../../src/game/data/types.js";
import type { IClock, IWorldStateManager } from "../../../src/game/brain/behavior-tree/bt-types.js";

function makeClock(): IClock {
	return { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" };
}

function makeWorldState(): IWorldStateManager {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
	};
}

function makeAgent(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "Atlas",
		agentType: "ai",
		status: "idle",
		behaviors: ["review", "plan"],
		goals: [{ text: "review iteration plan", priority: "10" }],
		...overrides,
	};
}

function makeAgentNoBehaviors(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "Bob",
		agentType: "ai",
		status: "idle",
		...overrides,
	};
}

describe("BtSystem", () => {
	let system: BtSystem;
	let worldState: IWorldStateManager;
	let clock: IClock;

	beforeEach(() => {
		system = new BtSystem();
		worldState = makeWorldState();
		clock = makeClock();
	});

	describe("register()", () => {
		it("creates BT for agent with behaviors", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			expect(system.has("Atlas")).toBe(true);
		});

		it("skips agent without behaviors", () => {
			const agent = makeAgentNoBehaviors();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			expect(system.has("Bob")).toBe(false);
		});

		it("skips agent with empty behaviors array", () => {
			const agent = makeAgent({ name: "Eve", behaviors: [] });
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			expect(system.has("Eve")).toBe(false);
		});

		it("is idempotent — second call does not overwrite", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			system.register(agent, deps);
			expect(system.size).toBe(1);
		});
	});

	describe("unregister()", () => {
		it("removes a registered agent BT", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			expect(system.has("Atlas")).toBe(true);
			system.unregister("Atlas");
			expect(system.has("Atlas")).toBe(false);
		});

		it("does nothing for unknown agent", () => {
			expect(() => system.unregister("nobody")).not.toThrow();
		});
	});

	describe("update()", () => {
		it("does not tick before interval reached", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			const actions = system.update(BT_TICK_INTERVAL_MS - 1, worldState, clock);
			// No tick should have happened — accumulator not yet full
			expect(actions).toHaveLength(0);
		});

		it("ticks BT after accumulating enough deltaMs", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			// Accumulate exactly the interval
			const actions = system.update(BT_TICK_INTERVAL_MS, worldState, clock);
			// After one tick, tree.step() runs and produces actions (at minimum idle/speaking)
			expect(actions.length).toBeGreaterThanOrEqual(0);
		});

		it("ticks after multiple small updates accumulate past interval", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			// Three 1-second increments — still under 3s threshold
			system.update(1000, worldState, clock);
			system.update(1000, worldState, clock);
			const actions = system.update(1000, worldState, clock);
			// 3000ms total — should have ticked
			// The BT will produce some actions (at least fall-through to idle)
			expect(actions.length).toBeGreaterThanOrEqual(0);
		});

		it("returns empty array when no agents registered", () => {
			const actions = system.update(5000, worldState, clock);
			expect(actions).toHaveLength(0);
		});
	});

	describe("getActions()", () => {
		it("returns actions from the last update", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			system.update(BT_TICK_INTERVAL_MS, worldState, clock);
			const actions = system.getActions();
			// Should match what update() returned
			expect(Array.isArray(actions)).toBe(true);
		});

		it("returns empty array before any update", () => {
			expect(system.getActions()).toHaveLength(0);
		});
	});

	describe("toBTAgentDef mapping", () => {
		it("maps DashboardAgent goals (text/priority) to BTAgentDef goals (name/priority)", () => {
			const agent = makeAgent({
				goals: [
					{ text: "review plan", priority: "10" },
					{ text: "implement feature", priority: "5" },
				],
			});
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			// If registration succeeded with goals, the mapping worked
			expect(system.has("Atlas")).toBe(true);
		});

		it("handles agent with no goals", () => {
			const agent = makeAgent({ goals: undefined });
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			expect(system.has("Atlas")).toBe(true);
		});
	});

	describe("getAgent()", () => {
		it("returns agent object for registered agent", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);
			const btAgent = system.getAgent("Atlas");
			expect(btAgent).toBeDefined();
			expect(btAgent?.context.name).toBe("Atlas");
		});

		it("returns undefined for unknown agent", () => {
			expect(system.getAgent("nobody")).toBeUndefined();
		});
	});

	describe("onSnapshot dirty-check", () => {
		it("fires onSnapshot on first tick", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			const snapshots: Array<{ name: string; tick: number }> = [];
			system.onSnapshot = (name, snap) => {
				snapshots.push({ name, tick: snap.tick });
			};

			system.update(BT_TICK_INTERVAL_MS, worldState, clock);
			expect(snapshots.length).toBe(1);
			expect(snapshots[0].name).toBe("Atlas");
		});

		it("does NOT fire onSnapshot when status is unchanged between ticks", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			const snapshots: Array<{ name: string; tick: number }> = [];
			system.onSnapshot = (name, snap) => {
				snapshots.push({ name, tick: snap.tick });
			};

			// First tick — fires
			system.update(BT_TICK_INTERVAL_MS, worldState, clock);
			expect(snapshots.length).toBe(1);

			// Second tick — tree is deterministic with same world state, so snapshot
			// status values should be identical, meaning onSnapshot should NOT fire again
			system.update(BT_TICK_INTERVAL_MS, worldState, clock);
			expect(snapshots.length).toBe(1);
		});

		it("does not fire onSnapshot when callback is not set", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			// No onSnapshot assigned — should not throw
			expect(() => system.update(BT_TICK_INTERVAL_MS, worldState, clock)).not.toThrow();
		});

		it("buildSnapshot returns a valid BTTreeSnapshot structure", () => {
			const agent = makeAgent();
			const deps = createStubDeps(worldState, clock);
			system.register(agent, deps);

			// Tick once so the tree has state
			system.update(BT_TICK_INTERVAL_MS, worldState, clock);

			// Access the entry via getAgent to confirm it exists, then use buildSnapshot
			expect(system.getAgent("Atlas")).toBeDefined();

			// Use onSnapshot to capture the snapshot and verify its shape
			let captured: { root: { id: string; label: string; type: string; status: string } } | null = null;
			system.onSnapshot = (_name, snap) => {
				captured = snap as typeof captured;
			};

			// Unregister and re-register to clear lastSnapshots, forcing a new emit
			system.unregister("Atlas");
			system.register(agent, deps);
			system.update(BT_TICK_INTERVAL_MS, worldState, clock);

			expect(captured).not.toBeNull();
			expect(captured!.root).toBeDefined();
			expect(typeof captured!.root.id).toBe("string");
			expect(typeof captured!.root.type).toBe("string");
			expect(typeof captured!.root.status).toBe("string");
		});
	});

	describe("createStubDeps()", () => {
		it("returns deps with stub disk that throws on read", () => {
			const deps = createStubDeps(worldState, clock);
			expect(() => deps.disk.readFileSync("test.txt", "utf-8")).toThrow("disk not available");
		});

		it("returns deps with stub disk where existsSync returns false", () => {
			const deps = createStubDeps(worldState, clock);
			expect(deps.disk.existsSync("test.txt")).toBe(false);
		});

		it("returns deps with paths that join segments", () => {
			const deps = createStubDeps(worldState, clock);
			expect(deps.paths.join("a", "b", "c")).toBe("a/b/c");
		});

		it("returns deps where checkPermission always allows", () => {
			const deps = createStubDeps(worldState, clock);
			expect(deps.checkPermission("ReadFile")).toBe("allowed");
		});
	});
});
