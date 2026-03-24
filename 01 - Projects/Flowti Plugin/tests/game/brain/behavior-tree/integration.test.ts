import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAgentBT } from "../../../../src/game/brain/behavior-tree/bt-factory.js";
import { btTick } from "../../../../src/game/brain/behavior-tree/bt-tick.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../src/game/brain/behavior-tree/bt-types.js";
import { createDefaultBlackboard } from "../../../../src/game/systems/blackboard.js";
import type { IEchoStore, Echo, EchoKind } from "../../../../src/game/systems/echo/echo-types.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: {
			readFileSync: vi.fn(() => "---\nstatus: in-progress\n---\n# Iteration Plan\n\n## Goals\n\n- Ship A\n\n## Risks\n\nNone."),
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => true),
			mkdirSync: vi.fn(),
		},
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		checkPermission: vi.fn(() => "allowed" as const),
		blackboard: createDefaultBlackboard(),
		...overrides,
	};
}

describe("BT integration — full tick cycle", () => {
	it("agent with goals goes through work cycle (needs-driven priority)", () => {
		const bb = createDefaultBlackboard();
		bb.nearestWorkstation = { x: 100, y: 100 };
		const applyNeedsEffect = vi.fn();
		const deps = makeDeps({ blackboard: bb, applyNeedsEffect });
		const agent: BTAgentDef = {
			name: "Atlas",
			agentType: "ai",
			attributes: { str: 10, int: 14, wis: 14, cha: 10, dex: 10, con: 14 },
			persona: "The Architect",
			mood: "focused",
			goals: [{ name: "review iteration plan", priority: 10 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Tick 1 — WorkCycle: PickGoal → GoToWorkstation returns "running" (walking)
		btTick(tree, btAgent, bb);
		expect(bb.intent).toBe("working");
		expect(bb.movementCommand).toBe("walk-to");

		// Simulate arrival at workstation
		bb.arrived = true;

		// Tick 2 — GoToWorkstation → succeeded → DoWork → LeaveWorkstation
		btTick(tree, btAgent, bb);

		// DoWork calls applyNeedsEffect, proving the work cycle completed
		expect(applyNeedsEffect).toHaveBeenCalledWith({ focus: -5, morale: 1 });
	});

	it("agent with low energy seeks rest instead of working", () => {
		const bb = createDefaultBlackboard();
		bb.nearestRestStation = { x: 50, y: 50 };
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Scout",
			agentType: "ai",
			goals: [{ name: "summarize report", priority: 5 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		// Set energy below threshold — NeedsEnergy branch fires
		btAgent.context.needs.energy = 10;

		// Single tick — NeedsEnergy branch fires: SeekRestSpot returns "running"
		btTick(tree, btAgent, bb);

		// Low energy should trigger seeking/rest intent on blackboard
		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("seek-rest");
		expect(bb.movementCommand).toBe("walk-to");
	});

	it("agent with no goals falls to idle behavior", () => {
		const bb = createDefaultBlackboard();
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Idle",
			agentType: "human",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btTick(tree, btAgent, bb);

		// With no goals, ActiveGoal branch fails -> should fall to idle
		expect(bb.intent).toBe("idle");
	});

	it("cascade hint triggers CascadeReaction before idle", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		bb.cascadeTarget = { x: 200, y: 150 };
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Scout",
			agentType: "ai",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btTick(tree, btAgent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("cascade-seek");
		expect(bb.movementCommand).toBe("walk-to");
		// Cascade hint should be cleared after acting
		expect(bb.cascadeHint).toBeNull();
	});

	it("whim is suppressed when needs are critical", () => {
		const bb = createDefaultBlackboard();
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Tired",
			agentType: "ai",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btAgent.context.needs.energy = 20; // Below 40 threshold
		btTick(tree, btAgent, bb);

		// Should NOT be a whim — should be idle or needs-driven
		expect(bb.intentDetail).not.toContain("whim");
	});

	it("force-break cascade hint triggers walk-to rest station", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "force-break";
		bb.nearestRestStation = { x: 80, y: 80 };
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent: btAgent } = createAgentBT(
			{ name: "Scout", agentType: "ai", goals: [] },
			deps,
		);

		btTick(tree, btAgent, bb);

		expect(bb.intent).toBe("on-break");
		expect(bb.intentDetail).toBe("cascade-break");
		expect(bb.movementCommand).toBe("walk-to");
		expect(bb.cascadeHint).toBeNull();
	});

	it("cascade reaction takes priority over whim", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		bb.cascadeTarget = { x: 300, y: 300 };
		bb.whimTarget = { x: 100, y: 100 }; // whim target also set
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent: btAgent } = createAgentBT(
			{ name: "Scout", agentType: "ai", goals: [] },
			deps,
		);

		btTick(tree, btAgent, bb);

		// Cascade fires first (higher priority in master MDSL)
		expect(bb.intentDetail).toBe("cascade-seek");
		expect(bb.movementTarget).toEqual({ x: 300, y: 300 });
	});

	it("permission denied on WriteFile causes graceful fallback", () => {
		const bb = createDefaultBlackboard();
		const checkPermission = vi.fn((tool: string) => tool === "Write" ? "denied" as const : "allowed" as const);
		const deps = makeDeps({ checkPermission, blackboard: bb });
		const agent: BTAgentDef = {
			name: "Blocked",
			agentType: "ai",
			goals: [{ name: "review plan", priority: 10 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Should not throw even when WriteFile is denied
		expect(() => {
			for (let i = 0; i < 5; i++) btTick(tree, btAgent, bb);
		}).not.toThrow();
	});
});

// ── Whim integration tests (require Math.random + echoStore mocking) ──

function makeEcho(overrides: Partial<Echo> = {}): Echo {
	return {
		id: "test", kind: "bond", source: "test", weight: 20, decay: 2,
		reinforcements: 0, lastReinforcedCycle: 0, tags: [], cycleCreated: 0,
		...overrides,
	};
}

function makeEchoStore(fn?: (agent: string, kind: EchoKind) => Echo | undefined): IEchoStore {
	return {
		addEcho: vi.fn(() => ({ added: true, cascadeTriggered: false })),
		queryWeight: vi.fn(() => 0),
		getDialogueBias: vi.fn(() => ({ targetOpinions: new Map(), moodResidueWeight: 0, memoryBoosts: new Map() })),
		getPreferences: vi.fn(() => []),
		getStrongest: vi.fn(fn ?? (() => undefined)),
		decayAll: vi.fn(() => ({ decayed: 0, evicted: 0 })),
		getCascadeBudget: vi.fn(() => 5),
		consumeCascade: vi.fn(() => true),
		resetCascadeBudget: vi.fn(),
		serialize: vi.fn(() => ({})),
		restore: vi.fn(),
	};
}

describe("BT integration — whim with echo store", () => {
	let randomSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
	});

	afterEach(() => {
		randomSpy.mockRestore();
	});

	const whimClock = { now: () => 10000, ms: () => 10000, iso: () => "2026-03-24T10:00:00Z" };

	it("bond whim walks to whimTarget position", () => {
		const bb = createDefaultBlackboard();
		bb.whimTarget = { x: 200, y: 150 };
		const store = makeEchoStore((_a, kind) =>
			kind === "bond" ? makeEcho({ kind: "bond", target: "Atlas", weight: 25 }) : undefined,
		);
		const deps = makeDeps({ blackboard: bb, clock: whimClock });
		const { tree, agent } = createAgentBT({ name: "Scout", agentType: "ai", goals: [] }, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("whim-visit");
		expect(bb.movementCommand).toBe("walk-to");
	});

	it("whim fallback wanders when no qualifying echo", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_a, kind) =>
			kind === "bond" ? makeEcho({ kind: "bond", weight: 5 }) : undefined,
		);
		const deps = makeDeps({ blackboard: bb, clock: whimClock });
		const { tree, agent } = createAgentBT({ name: "Scout", agentType: "ai", goals: [] }, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);

		expect(bb.movementCommand).toBe("wander");
	});

	it("whim cooldown prevents double-fire within 6s", () => {
		const bb = createDefaultBlackboard();
		const store = makeEchoStore((_a, kind) =>
			kind === "mood-residue" ? makeEcho({ kind: "mood-residue", weight: 25 }) : undefined,
		);
		let clockMs = 10000;
		const deps = makeDeps({
			blackboard: bb,
			clock: { now: () => clockMs, ms: () => clockMs, iso: () => "2026-03-24T10:00:00Z" },
		});
		const { tree, agent } = createAgentBT({ name: "Scout", agentType: "ai", goals: [] }, deps);
		agent.context.echoStore = store;

		btTick(tree, agent, bb);
		expect(bb.intentDetail).toBe("celebrating");
		expect(bb.speechRequest).not.toBeNull();

		// Reset and tick at +3s (within cooldown)
		bb.intent = "idle"; bb.intentDetail = ""; bb.speechRequest = null;
		clockMs = 13000;
		btTick(tree, agent, bb);
		expect(bb.intentDetail).not.toBe("celebrating");

		// Reset and tick at +7s (past cooldown)
		bb.intent = "idle"; bb.intentDetail = "";
		clockMs = 17000;
		btTick(tree, agent, bb);
		expect(bb.intentDetail).toBe("celebrating");
	});

	it("needs-driven branches take priority over whim", () => {
		const bb = createDefaultBlackboard();
		bb.nearestRestStation = { x: 50, y: 50 };
		const store = makeEchoStore((_a, kind) =>
			kind === "mood-residue" ? makeEcho({ kind: "mood-residue", weight: 25 }) : undefined,
		);
		const deps = makeDeps({ blackboard: bb, clock: whimClock });
		const { tree, agent } = createAgentBT({ name: "Scout", agentType: "ai", goals: [] }, deps);
		agent.context.echoStore = store;
		agent.context.needs.energy = 10; // triggers NeedsEnergy before Whim

		btTick(tree, agent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("seek-rest");
	});
});
