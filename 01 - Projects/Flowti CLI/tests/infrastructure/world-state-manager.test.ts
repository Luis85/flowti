import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createWorldStateManager } from "../../src/infrastructure/world-state-manager.js";
import type { AgentAction, IWorldStateManager } from "../../src/domain/agents/world-state-types.js";

function makeDeps() {
	return {
		disk: {
			readFileSync: vi.fn(() => "{}"),
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => false),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
		},
		paths: {
			join: vi.fn((...args: string[]) => args.join("/")),
			resolve: vi.fn((...args: string[]) => args.join("/")),
		},
		clock: {
			now: vi.fn(() => new Date()),
			ms: vi.fn(() => 1000),
			iso: vi.fn(() => "2026-03-15T12:00:00Z"),
			safeIso: vi.fn(() => "2026-03-15"),
		},
	} as never;
}

describe("WorldStateManager", () => {
	let mgr: IWorldStateManager;
	let deps: ReturnType<typeof makeDeps>;

	beforeEach(() => {
		vi.useFakeTimers();
		deps = makeDeps();
		mgr = createWorldStateManager(deps, "/vault");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts with empty state", () => {
		const state = mgr.getState();
		expect(state.version).toBe(1);
		expect(Object.keys(state.entities)).toHaveLength(0);
		expect(state.activityLog).toHaveLength(0);
	});

	it("updateEntity creates entity with components", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		const entity = mgr.getEntity("Bob");
		expect(entity).not.toBeNull();
		expect(entity!.type).toBe("agent");
		expect(entity!.components.identity).toEqual({ name: "Bob" });
	});

	it("updateEntity merges components", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		mgr.updateEntity("Bob", "agent", { status: { state: "busy" } });
		const entity = mgr.getEntity("Bob");
		expect(entity!.components.identity).toEqual({ name: "Bob" });
		expect(entity!.components.status).toEqual({ state: "busy" });
	});

	it("emitAction updates entity status component", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "using-tool", data: { tool: "Edit" } };
		mgr.emitAction(action);
		const entity = mgr.getEntity("Bob");
		expect(entity!.components.status).toEqual({ state: "busy", currentAction: "using-tool", toolName: "Edit" });
	});

	it("emitAction appends to activity log", () => {
		mgr.updateEntity("Bob", "agent", {});
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "speaking", data: { text: "Hello" } };
		mgr.emitAction(action);
		expect(mgr.getState().activityLog).toHaveLength(1);
		expect(mgr.getState().activityLog[0].type).toBe("speaking");
	});

	it("activity log caps at 100", () => {
		mgr.updateEntity("Bob", "agent", {});
		for (let i = 0; i < 110; i++) {
			mgr.emitAction({ id: `a${i}`, agentName: "Bob", timestamp: "t", type: "thinking", data: {} });
		}
		expect(mgr.getState().activityLog).toHaveLength(100);
	});

	it("debounces write to disk", () => {
		mgr.updateEntity("Bob", "agent", {});
		expect(deps.disk.writeFileSync).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1100);
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("flush writes immediately", () => {
		mgr.updateEntity("Bob", "agent", {});
		mgr.flush();
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("getEntity returns null for missing entity", () => {
		expect(mgr.getEntity("NonExistent")).toBeNull();
	});

	it("calls all registered action listeners", () => {
		const calls1: AgentAction[] = [];
		const calls2: AgentAction[] = [];
		mgr.addActionListener((a) => calls1.push(a));
		mgr.addActionListener((a) => calls2.push(a));
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "thinking", data: {} };
		mgr.emitAction(action);
		expect(calls1).toHaveLength(1);
		expect(calls2).toHaveLength(1);
	});

	it("removeActionListener stops calls to removed listener", () => {
		const calls: AgentAction[] = [];
		const listener = (a: AgentAction): void => { calls.push(a); };
		mgr.addActionListener(listener);
		mgr.removeActionListener(listener);
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "thinking", data: {} };
		mgr.emitAction(action);
		expect(calls).toHaveLength(0);
	});

	it("permission-denied maps to idle state", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "permission-denied", data: {} };
		mgr.emitAction(action);
		const entity = mgr.getEntity("Bob");
		expect(entity?.components.status).toMatchObject({ state: "idle" });
	});
});
