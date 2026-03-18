import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPluginProvider } from "../../../src/game/config/plugin-provider.js";
import type { PluginProviderDeps } from "../../../src/game/config/plugin-provider.js";
import type { DashboardAgent, WorldState } from "../../../src/game/data/types.js";

function makeVaultAdapter(files: Record<string, string> = {}) {
	return {
		exists: vi.fn(async (path: string) => path in files),
		read: vi.fn(async (path: string) => files[path] ?? ""),
	};
}

function makeEventBus() {
	const listeners = new Map<string, Array<(event: { type: string; payload: unknown }) => void>>();
	return {
		on: vi.fn((type: string, cb: (event: { type: string; payload: unknown }) => void) => {
			const list = listeners.get(type) ?? [];
			list.push(cb);
			listeners.set(type, list);
			return () => {
				const current = listeners.get(type) ?? [];
				listeners.set(type, current.filter((fn) => fn !== cb));
			};
		}),
		emit: vi.fn((type: string, payload: unknown) => {
			const list = listeners.get(type) ?? [];
			for (const cb of list) cb({ type, payload });
		}),
		_trigger: (type: string, payload: unknown) => {
			const list = listeners.get(type) ?? [];
			for (const cb of list) cb({ type, payload });
		},
		_listenerCount: (type: string) => (listeners.get(type) ?? []).length,
	};
}

const AGENT_ROSTER_PATH = ".flowti/agents/data/agent-dashboard.json";
const WORLD_STATE_PATH = ".flowti/var/world-state.json";

const sampleAgent: DashboardAgent = {
	name: "Atlas",
	agentType: "engineer",
	status: "idle",
};

const sampleWorldState: WorldState = {
	version: 1,
	updatedAt: "2026-03-18T00:00:00Z",
	entities: {},
	permissions: {},
	activityLog: [],
};

describe("createPluginProvider", () => {
	let vaultAdapter: ReturnType<typeof makeVaultAdapter>;
	let eventBus: ReturnType<typeof makeEventBus>;
	let deps: PluginProviderDeps;

	beforeEach(() => {
		vaultAdapter = makeVaultAdapter();
		eventBus = makeEventBus();
		deps = { vaultAdapter, eventBus };
	});

	it("reads agents from vault file on start", async () => {
		vaultAdapter = makeVaultAdapter({
			[AGENT_ROSTER_PATH]: JSON.stringify({ agents: [sampleAgent] }),
		});
		deps = { vaultAdapter, eventBus };
		const provider = createPluginProvider(deps);
		await provider.start();

		const agents = await provider.getDashboardAgents();
		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe("Atlas");
	});

	it("reads world state from vault file on start", async () => {
		vaultAdapter = makeVaultAdapter({
			[WORLD_STATE_PATH]: JSON.stringify(sampleWorldState),
		});
		deps = { vaultAdapter, eventBus };
		const provider = createPluginProvider(deps);
		await provider.start();

		const state = await provider.getWorldState();
		expect(state).not.toBeNull();
		expect(state?.version).toBe(1);
		expect(state?.updatedAt).toBe("2026-03-18T00:00:00Z");
	});

	it("returns empty agents when vault file is missing", async () => {
		const provider = createPluginProvider(deps);
		await provider.start();

		const agents = await provider.getDashboardAgents();
		expect(agents).toHaveLength(0);
	});

	it("returns null world state when vault file is missing", async () => {
		const provider = createPluginProvider(deps);
		await provider.start();

		const state = await provider.getWorldState();
		expect(state).toBeNull();
	});

	it("subscribes to EventBus relayed events on start", async () => {
		const provider = createPluginProvider(deps);
		await provider.start();

		expect(eventBus.on).toHaveBeenCalledWith("agent.status.changed", expect.any(Function));
		expect(eventBus.on).toHaveBeenCalledWith("agent.message.received", expect.any(Function));
		expect(eventBus.on).toHaveBeenCalledWith("agent.message.sent", expect.any(Function));
	});

	it("unsubscribes from EventBus on stop", async () => {
		const provider = createPluginProvider(deps);
		await provider.start();

		expect(eventBus._listenerCount("agent.status.changed")).toBe(1);
		provider.stop();
		expect(eventBus._listenerCount("agent.status.changed")).toBe(0);
	});

	it("relays EventBus agent actions to onAction callbacks", async () => {
		const provider = createPluginProvider(deps);
		await provider.start();

		const received: unknown[] = [];
		provider.onAction((action) => { received.push(action); });

		const action = {
			id: "a1",
			agentName: "Atlas",
			timestamp: "2026-03-18T00:00:00Z",
			type: "thinking" as const,
			data: {},
		};

		eventBus._trigger("agent.status.changed", action);
		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(action);
	});
});
