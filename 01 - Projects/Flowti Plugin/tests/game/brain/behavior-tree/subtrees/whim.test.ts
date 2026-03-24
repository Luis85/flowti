import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WHIM_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/whim.js";
import { createAgentBT } from "../../../../../src/game/brain/behavior-tree/bt-factory.js";
import { btTick } from "../../../../../src/game/brain/behavior-tree/bt-tick.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../../src/game/brain/behavior-tree/bt-types.js";
import { createDefaultBlackboard } from "../../../../../src/game/systems/blackboard.js";
import type { IEchoStore, Echo, EchoKind } from "../../../../../src/game/systems/echo/echo-types.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), existsSync: vi.fn(() => false), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 10000, ms: () => 10000, iso: () => "2026-03-24T10:00:00Z" },
		checkPermission: vi.fn(() => "allowed" as const),
		blackboard: createDefaultBlackboard(),
		...overrides,
	};
}

function makeEcho(overrides: Partial<Echo> = {}): Echo {
	return {
		id: "test",
		kind: "bond",
		source: "test",
		weight: 20,
		decay: 2,
		reinforcements: 0,
		lastReinforcedCycle: 0,
		tags: [],
		cycleCreated: 0,
		...overrides,
	};
}

function makeEchoStore(getStrongestFn?: (agent: string, kind: EchoKind) => Echo | undefined): IEchoStore {
	return {
		addEcho: vi.fn(() => ({ added: true, cascadeTriggered: false })),
		queryWeight: vi.fn(() => 0),
		getDialogueBias: vi.fn(() => ({ targetOpinions: new Map(), moodResidueWeight: 0, memoryBoosts: new Map() })),
		getPreferences: vi.fn(() => []),
		getStrongest: vi.fn(getStrongestFn ?? (() => undefined)),
		decayAll: vi.fn(() => ({ decayed: 0, evicted: 0 })),
		getCascadeBudget: vi.fn(() => 5),
		consumeCascade: vi.fn(() => true),
		resetCascadeBudget: vi.fn(),
		serialize: vi.fn(() => ({})),
		restore: vi.fn(),
	};
}

const baseAgent: BTAgentDef = { name: "Scout", agentType: "ai", goals: [] };

describe("WHIM_SUBTREE MDSL", () => {
	it("has root node named Whim", () => {
		expect(WHIM_SUBTREE).toContain("root [Whim]");
	});

	it("gates on HasWhim condition", () => {
		expect(WHIM_SUBTREE).toContain("condition [HasWhim]");
	});

	it("contains ExecuteWhim action", () => {
		expect(WHIM_SUBTREE).toContain("action [ExecuteWhim]");
	});
});

describe("Whim — full BT tick", () => {
	let randomSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Force Math.random to always return 0 (below any probability threshold)
		randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
	});

	afterEach(() => {
		randomSpy.mockRestore();
	});

	it("bond whim: walks to whimTarget when sensor provides it", () => {
		const bb = createDefaultBlackboard();
		bb.whimTarget = { x: 200, y: 150 };
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "bond") return makeEcho({ kind: "bond", target: "Atlas", weight: 25 });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("whim-visit");
		expect(bb.movementCommand).toBe("walk-to");
		expect(bb.movementTarget).toEqual({ x: 200, y: 150 });
	});

	it("preference shop whim: walks to merchant stall", () => {
		const bb = createDefaultBlackboard();
		bb.nearestMerchantStall = { x: 300, y: 60 };
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "preference") return makeEcho({ kind: "preference", weight: 15, tags: ["shop"] });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("whim-shop");
		expect(bb.movementCommand).toBe("walk-to");
		expect(bb.movementTarget).toEqual({ x: 300, y: 60 });
	});

	it("aversion whim: writes roomAvoidance when aversion matches current room", () => {
		const bb = createDefaultBlackboard();
		bb.currentRoom = "hub";
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "aversion") return makeEcho({ kind: "aversion", target: "hub", weight: -15 });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.roomAvoidance).toBe("hub");
	});

	it("positive mood-residue triggers celebrate speech", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "mood-residue") return makeEcho({ kind: "mood-residue", weight: 25 });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.intentDetail).toBe("celebrating");
		expect(bb.speechRequest).not.toBeNull();
		expect(bb.speechRequest!.kind).toBe("speech");
	});

	it("negative mood-residue triggers mope wander", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "mood-residue") return makeEcho({ kind: "mood-residue", weight: -15 });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.intentDetail).toBe("moping");
		expect(bb.movementCommand).toBe("wander");
	});

	it("fallback: wanders when no qualifying echo", () => {
		const bb = createDefaultBlackboard();
		// Store returns echoes with non-zero weight (to pass HasWhim gate) but none qualifying
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "bond") return makeEcho({ kind: "bond", weight: 5 }); // below 15 threshold
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.movementCommand).toBe("wander");
	});

	it("suppressed when energy < 40 (needs take priority)", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "mood-residue") return makeEcho({ kind: "mood-residue", weight: 25 });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;
		agent.context.needs.energy = 20;

		btTick(tree, agent, bb);

		// Should NOT be a whim — needs-driven behavior fires instead
		expect(bb.intentDetail).not.toContain("whim");
		expect(bb.intentDetail).not.toBe("celebrating");
		expect(bb.intentDetail).not.toBe("moping");
	});

	it("suppressed when hunger < 40", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "mood-residue") return makeEcho({ kind: "mood-residue", weight: 25 });
			return undefined;
		});
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;
		agent.context.needs.hunger = 20;

		btTick(tree, agent, bb);

		expect(bb.intentDetail).not.toBe("celebrating");
	});

	it("suppressed when echoStore is undefined", () => {
		const bb = createDefaultBlackboard();
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);
		// echoStore not set → remains undefined

		btTick(tree, agent, bb);

		expect(bb.intentDetail).not.toContain("whim");
		expect(bb.intentDetail).not.toBe("celebrating");
	});

	it("cooldown prevents double-firing within 6s", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_agent, kind) => {
			if (kind === "mood-residue") return makeEcho({ kind: "mood-residue", weight: 25 });
			return undefined;
		});
		let clockMs = 10000;
		const deps = makeDeps({
			blackboard: bb,
			clock: { now: () => clockMs, ms: () => clockMs, iso: () => "2026-03-24T10:00:00Z" },
		});
		const { tree, agent } = createAgentBT(baseAgent, deps);
		agent.context.echoStore = store;

		// First tick — whim fires
		btTick(tree, agent, bb);
		expect(bb.intentDetail).toBe("celebrating");

		// Reset blackboard state for second tick
		bb.intent = "idle";
		bb.intentDetail = "";
		bb.speechRequest = null;

		// Second tick at +3s — within cooldown, whim should NOT fire
		clockMs = 13000;
		btTick(tree, agent, bb);
		expect(bb.intentDetail).not.toBe("celebrating");

		// Reset again
		bb.intent = "idle";
		bb.intentDetail = "";

		// Third tick at +7s — past cooldown, whim should fire again
		clockMs = 17000;
		btTick(tree, agent, bb);
		expect(bb.intentDetail).toBe("celebrating");
	});
});
