// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IEventBus, EventHandler, EventType, FlowtiEvent } from "../../../src/infrastructure/events/types";

// ── Mock SSE Client ─────────────────────────────────────────

const mockSseConnect = vi.fn();
const mockSseDisconnect = vi.fn();
const mockSseOn = vi.fn<(type: string, cb: (data: Record<string, unknown>) => void) => () => void>().mockReturnValue(() => {});
const mockSseOnDisconnect = vi.fn();

vi.mock("../../../src/infrastructure/agents/sse-client.js", () => {
	class MockSseClient {
		connect = mockSseConnect;
		disconnect = mockSseDisconnect;
		on = mockSseOn;
		onDisconnect = mockSseOnDisconnect;
		connected = false;
	}
	return { SseClient: MockSseClient };
});

// ── Mock fetch ──────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ─────────────────────────────────────────────────

type HandlerEntry = { type: EventType | string; handler: EventHandler };

function createMockEventBus(): IEventBus & { handlers: HandlerEntry[]; fireEvent: (type: string, payload: unknown) => void } {
	const handlers: HandlerEntry[] = [];
	const bus: IEventBus & { handlers: HandlerEntry[]; fireEvent: (type: string, payload: unknown) => void } = {
		handlers,
		emit: vi.fn(),
		emitCustom: vi.fn(),
		on: vi.fn((type: string, handler: EventHandler) => {
			const entry = { type, handler };
			handlers.push(entry);
			return () => {
				const idx = handlers.indexOf(entry);
				if (idx >= 0) handlers.splice(idx, 1);
			};
		}) as IEventBus["on"],
		once: vi.fn() as IEventBus["once"],
		off: vi.fn() as IEventBus["off"],
		clear: vi.fn(),
		fireEvent(type: string, payload: unknown) {
			for (const entry of handlers) {
				if (entry.type === type) {
					entry.handler({ type, payload, timestamp: new Date().toISOString() } as FlowtiEvent);
				}
			}
		},
	};
	return bus;
}

function createConfig(overrides: Record<string, unknown> = {}): import("../../../src/infrastructure/agents/world-bridge").WorldBridgeConfig {
	return {
		containerElement: document.createElement("div"),
		eventBus: createMockEventBus(),
		assetBasePath: "http://localhost:3000/",
		baseUrl: "http://localhost:3000",
		initialWorldState: { entities: { atlas: { id: "atlas" } } },
		...overrides,
	} as import("../../../src/infrastructure/agents/world-bridge").WorldBridgeConfig;
}

// ── Import (after mocks) ───────────────────────────────────

import { WorldBridge } from "../../../src/infrastructure/agents/world-bridge";

// ── Tests ───────────────────────────────────────────────────

describe("WorldBridge", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSseOn.mockReturnValue(() => {});
	});

	it("getWorldState() returns the initial state passed in config", async () => {
		const config = createConfig();
		const bridge = new WorldBridge(config);
		const state = await bridge.getWorldState();
		expect(state).toEqual({ entities: { atlas: { id: "atlas" } } });
	});

	it("getWorldState() returns null when no initial state", async () => {
		const config = createConfig({ initialWorldState: null });
		const bridge = new WorldBridge(config);
		expect(await bridge.getWorldState()).toBeNull();
	});

	it("onAction() receives events pushed from EventBus agent events", () => {
		const config = createConfig();
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		const bridge = new WorldBridge(config);
		const received: unknown[] = [];
		bridge.onAction((event) => received.push(event));

		bus.fireEvent("agent.status.changed", { agent: "atlas", activity: "thinking" });
		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({
			type: "agent.status.changed",
			payload: { agent: "atlas", activity: "thinking" },
		});
	});

	it("sendCommand() calls fetch when serverOnline is true", async () => {
		mockFetch.mockResolvedValue({ ok: true, status: 200 });
		const config = createConfig();
		const bridge = new WorldBridge(config);
		bridge.serverOnline = true;

		await bridge.sendCommand("/api/agent/send", { agent: "atlas", message: "hello" });
		expect(mockFetch).toHaveBeenCalledWith(
			"http://localhost:3000/api/agent/send",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ agent: "atlas", message: "hello" }),
			}),
		);
	});

	it("sendCommand() emits via EventBus when serverOnline is false", async () => {
		const config = createConfig();
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		const bridge = new WorldBridge(config);
		bridge.serverOnline = false;

		await bridge.sendCommand("/api/agent/send", { agent: "atlas", message: "hello" });
		expect(mockFetch).not.toHaveBeenCalled();
		expect(bus.emitCustom).toHaveBeenCalledWith("world.command", {
			endpoint: "/api/agent/send",
			body: { agent: "atlas", message: "hello" },
		});
	});

	it("dispose() unsubscribes all listeners and disconnects SSE", () => {
		const config = createConfig();
		const bridge = new WorldBridge(config);
		const received: unknown[] = [];
		bridge.onAction((event) => received.push(event));

		bridge.dispose();

		// EventBus handlers should be removed
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		expect(bus.handlers).toHaveLength(0);

		// SSE disconnect should be called
		expect(mockSseDisconnect).toHaveBeenCalled();

		// No events should propagate after dispose
		bus.fireEvent("agent.status.changed", { agent: "atlas", activity: "idle" });
		expect(received).toHaveLength(0);
	});

	it("pause() buffers events, resume() flushes them", () => {
		const config = createConfig();
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		const bridge = new WorldBridge(config);
		const received: unknown[] = [];
		bridge.onAction((event) => received.push(event));

		bridge.pause();
		bus.fireEvent("agent.status.changed", { agent: "atlas", activity: "thinking" });
		bus.fireEvent("agent.message.received", { agent: "atlas", turn: {} });

		// Nothing should arrive while paused
		expect(received).toHaveLength(0);

		bridge.resume();
		// All buffered events should flush
		expect(received).toHaveLength(2);
		expect((received[0] as Record<string, unknown>).type).toBe("agent.status.changed");
		expect((received[1] as Record<string, unknown>).type).toBe("agent.message.received");
	});

	it("buffer caps at 50 events (drops oldest)", () => {
		const config = createConfig();
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		const bridge = new WorldBridge(config);
		const received: unknown[] = [];
		bridge.onAction((event) => received.push(event));

		bridge.pause();
		for (let i = 0; i < 60; i++) {
			bus.fireEvent("agent.status.changed", { agent: "atlas", activity: `action-${i}` });
		}

		bridge.resume();
		// Should only have 50 events, the first 10 dropped
		expect(received).toHaveLength(50);
		const first = received[0] as { type: string; payload: { activity: string } };
		expect(first.payload.activity).toBe("action-10");
	});

	it("assetBasePath is passed through from config", () => {
		const config = createConfig({ assetBasePath: "http://localhost:3000/" });
		const bridge = new WorldBridge(config);
		expect(bridge.assetBasePath).toBe("http://localhost:3000/");
	});

	it("hasEventBusListeners returns true after construction", () => {
		const config = createConfig();
		const bridge = new WorldBridge(config);
		expect(bridge.hasEventBusListeners).toBe(true);
	});

	it("hasEventBusListeners returns false after dispose", () => {
		const config = createConfig();
		const bridge = new WorldBridge(config);
		bridge.dispose();
		expect(bridge.hasEventBusListeners).toBe(false);
	});

	it("connectServer() sets serverOnline and connects SSE when server responds", async () => {
		mockFetch.mockResolvedValue({ ok: true, status: 200 });
		const config = createConfig();
		const bridge = new WorldBridge(config);

		await bridge.connectServer();
		expect(bridge.serverOnline).toBe(true);
		expect(mockSseConnect).toHaveBeenCalled();
	});

	it("connectServer() remains offline when server probe fails", async () => {
		mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
		const config = createConfig();
		const bridge = new WorldBridge(config);

		await bridge.connectServer();
		expect(bridge.serverOnline).toBe(false);
		expect(mockSseConnect).not.toHaveBeenCalled();
	});

	it("onAction unsubscribe stops delivery", () => {
		const config = createConfig();
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		const bridge = new WorldBridge(config);
		const received: unknown[] = [];
		const unsub = bridge.onAction((event) => received.push(event));

		unsub();
		bus.fireEvent("agent.status.changed", { agent: "atlas", activity: "idle" });
		expect(received).toHaveLength(0);
	});

	it("onEntityUpdate receives events", () => {
		const config = createConfig();
		const bus = config.eventBus as ReturnType<typeof createMockEventBus>;
		const bridge = new WorldBridge(config);
		const received: unknown[] = [];
		bridge.onEntityUpdate((event) => received.push(event));

		bus.fireEvent("agent.status.changed", { agent: "atlas", activity: "idle" });
		expect(received).toHaveLength(1);
	});

	it("containerElement is exposed from config", () => {
		const el = document.createElement("div");
		const config = createConfig({ containerElement: el });
		const bridge = new WorldBridge(config);
		expect(bridge.containerElement).toBe(el);
	});
});
