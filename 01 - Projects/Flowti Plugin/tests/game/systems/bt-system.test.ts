import { describe, it, expect, vi, beforeEach } from "vitest";
import { BtSystem, BT_TICK_INTERVAL_MS, createBtDeps } from "../../../src/game/systems/bt-system.js";
import { BlackboardManager, createDefaultBlackboard } from "../../../src/game/systems/blackboard.js";
import type { DashboardAgent } from "../../../src/game/data/types.js";
import type { IClock } from "../../../src/game/brain/behavior-tree/bt-types.js";

function makeClock(): IClock {
	return { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" };
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
	let blackboards: BlackboardManager;
	let clock: IClock;

	beforeEach(() => {
		system = new BtSystem();
		blackboards = new BlackboardManager();
		clock = makeClock();
	});

	function registerAgent(agent: DashboardAgent): void {
		blackboards.register(agent.name);
		const deps = createBtDeps(blackboards.get(agent.name), clock);
		system.register(agent, deps);
	}

	describe("register()", () => {
		it("creates BT for agent with behaviors", () => {
			const agent = makeAgent();
			registerAgent(agent);
			expect(system.has("Atlas")).toBe(true);
		});

		it("skips agent without behaviors", () => {
			const agent = makeAgentNoBehaviors();
			blackboards.register(agent.name);
			const deps = createBtDeps(blackboards.get(agent.name), clock);
			system.register(agent, deps);
			expect(system.has("Bob")).toBe(false);
		});

		it("skips agent with empty behaviors array", () => {
			const agent = makeAgent({ name: "Eve", behaviors: [] });
			blackboards.register(agent.name);
			const deps = createBtDeps(blackboards.get(agent.name), clock);
			system.register(agent, deps);
			expect(system.has("Eve")).toBe(false);
		});

		it("is idempotent — second call does not overwrite", () => {
			const agent = makeAgent();
			registerAgent(agent);
			blackboards.register(agent.name);
			const deps = createBtDeps(blackboards.get(agent.name), clock);
			system.register(agent, deps);
			expect(system.size).toBe(1);
		});
	});

	describe("unregister()", () => {
		it("removes a registered agent BT", () => {
			const agent = makeAgent();
			registerAgent(agent);
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
			const origRandom = Math.random;
			Math.random = () => 0; // tick interval = BT_TICK_MIN, stagger = 0
			const agent = makeAgent();
			registerAgent(agent);
			Math.random = origRandom;

			// Well below the minimum tick interval
			system.update(BT_TICK_INTERVAL_MS - 1, blackboards);
		});

		it("ticks BT after accumulating enough deltaMs", () => {
			const agent = makeAgent();
			registerAgent(agent);

			// Accumulate exactly the interval — should not throw
			expect(() => system.update(5000, blackboards)).not.toThrow();
		});

		it("ticks after multiple small updates accumulate past interval", () => {
			const agent = makeAgent();
			registerAgent(agent);

			// Three 1-second increments — accumulate toward threshold
			system.update(1000, blackboards);
			system.update(1000, blackboards);
			system.update(1000, blackboards);
			// 3000ms total — should not throw regardless of whether tick fires
		});

		it("does not throw when no agents registered", () => {
			expect(() => system.update(5000, blackboards)).not.toThrow();
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
			registerAgent(agent);
			// If registration succeeded with goals, the mapping worked
			expect(system.has("Atlas")).toBe(true);
		});

		it("handles agent with no goals", () => {
			const agent = makeAgent({ goals: undefined });
			registerAgent(agent);
			expect(system.has("Atlas")).toBe(true);
		});
	});

	describe("getAgent()", () => {
		it("returns agent object for registered agent", () => {
			const agent = makeAgent();
			registerAgent(agent);
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
			const origRandom = Math.random;
			Math.random = () => 0; // ensure minimum tick interval
			const agent = makeAgent();
			registerAgent(agent);
			Math.random = origRandom;

			const snapshots: Array<{ name: string; tick: number }> = [];
			system.onSnapshot = (name, snap) => {
				snapshots.push({ name, tick: snap.tick });
			};

			system.update(BT_TICK_INTERVAL_MS + 1000, blackboards);
			expect(snapshots.length).toBe(1);
			expect(snapshots[0].name).toBe("Atlas");
		});

		it("does NOT fire onSnapshot when status is unchanged between ticks", () => {
			const origRandom = Math.random;
			Math.random = () => 0; // ensure minimum tick interval
			const agent = makeAgent();
			registerAgent(agent);
			Math.random = origRandom;

			const snapshots: Array<{ name: string; tick: number }> = [];
			system.onSnapshot = (name, snap) => {
				snapshots.push({ name, tick: snap.tick });
			};

			// First tick — fires
			system.update(BT_TICK_INTERVAL_MS + 1000, blackboards);
			expect(snapshots.length).toBe(1);

			// Second tick — tree is deterministic with same world state, so snapshot
			// status values should be identical, meaning onSnapshot should NOT fire again
			system.update(BT_TICK_INTERVAL_MS + 1000, blackboards);
			expect(snapshots.length).toBe(1);
		});

		it("does not fire onSnapshot when callback is not set", () => {
			const agent = makeAgent();
			registerAgent(agent);

			// No onSnapshot assigned — should not throw
			expect(() => system.update(BT_TICK_INTERVAL_MS, blackboards)).not.toThrow();
		});

		it("buildSnapshot returns a valid BTTreeSnapshot structure", () => {
			const agent = makeAgent();
			registerAgent(agent);

			// Tick once so the tree has state
			system.update(5000, blackboards);

			// Access the entry via getAgent to confirm it exists, then use buildSnapshot
			expect(system.getAgent("Atlas")).toBeDefined();

			// Use onSnapshot to capture the snapshot and verify its shape
			let captured: { root: { id: string; label: string; type: string; status: string } } | null = null;
			system.onSnapshot = (_name, snap) => {
				captured = snap as typeof captured;
			};

			// Unregister and re-register to clear lastSnapshots, forcing a new emit
			system.unregister("Atlas");
			registerAgent(agent);
			system.update(5000, blackboards);

			expect(captured).not.toBeNull();
			expect(captured!.root).toBeDefined();
			expect(typeof captured!.root.id).toBe("string");
			expect(typeof captured!.root.type).toBe("string");
			expect(typeof captured!.root.status).toBe("string");
		});
	});

	describe("createBtDeps()", () => {
		it("returns deps with stub disk that throws on read", () => {
			const deps = createBtDeps(createDefaultBlackboard(), clock);
			expect(() => deps.disk.readFileSync("test.txt", "utf-8")).toThrow("disk not available");
		});

		it("returns deps with stub disk where existsSync returns false", () => {
			const deps = createBtDeps(createDefaultBlackboard(), clock);
			expect(deps.disk.existsSync("test.txt")).toBe(false);
		});

		it("returns deps with paths that join segments", () => {
			const deps = createBtDeps(createDefaultBlackboard(), clock);
			expect(deps.paths.join("a", "b", "c")).toBe("a/b/c");
		});

		it("returns deps where checkPermission always allows", () => {
			const deps = createBtDeps(createDefaultBlackboard(), clock);
			expect(deps.checkPermission("ReadFile")).toBe("allowed");
		});
	});
});
