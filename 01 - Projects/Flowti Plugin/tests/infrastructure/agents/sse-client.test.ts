import { describe, it, expect, vi, beforeEach } from "vitest";
import { SseClient } from "../../../src/infrastructure/agents/sse-client";

class MockEventSource {
	static OPEN = 1;
	static CLOSED = 2;
	static CONNECTING = 0;

	url: string;
	listeners = new Map<string, Set<EventListener>>();
	closed = false;
	readyState = MockEventSource.OPEN;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onopen: (() => void) | null = null;

	constructor(url: string) {
		this.url = url;
	}
	addEventListener(type: string, cb: EventListener) {
		const set = this.listeners.get(type) ?? new Set();
		set.add(cb);
		this.listeners.set(type, set);
	}
	removeEventListener(type: string, cb: EventListener) {
		this.listeners.get(type)?.delete(cb);
	}
	close() {
		this.closed = true;
		this.readyState = MockEventSource.CLOSED;
	}
	simulateEvent(type: string, data: string) {
		const event = { data } as MessageEvent;
		for (const cb of this.listeners.get(type) ?? []) cb(event);
	}
}

let mockEs: MockEventSource;
vi.stubGlobal("EventSource", class FakeEventSource {
	static OPEN = 1;
	static CLOSED = 2;
	static CONNECTING = 0;
	constructor(url: string) {
		mockEs = new MockEventSource(url);
		return mockEs as unknown as FakeEventSource;
	}
});

describe("SseClient", () => {
	beforeEach(() => { mockEs = undefined as unknown as MockEventSource; });

	it("connects to the given URL", () => {
		const client = new SseClient("http://localhost:3000/events");
		client.connect();
		expect(mockEs.url).toBe("http://localhost:3000/events");
	});

	it("emits parsed events to subscribers", () => {
		const client = new SseClient("http://localhost:3000/events");
		const events: unknown[] = [];
		client.on("agent-action", (data) => events.push(data));
		client.connect();
		mockEs.simulateEvent("agent-action", JSON.stringify({ agentName: "atlas", type: "thinking" }));
		expect(events).toHaveLength(1);
	});

	it("disconnect closes EventSource", () => {
		const client = new SseClient("http://localhost:3000/events");
		client.connect();
		client.disconnect();
		expect(mockEs.closed).toBe(true);
	});

	it("reports connected state", () => {
		const client = new SseClient("http://localhost:3000/events");
		expect(client.connected).toBe(false);
		client.connect();
		expect(client.connected).toBe(true);
		client.disconnect();
		expect(client.connected).toBe(false);
	});

	it("unsubscribe removes callback from set", () => {
		const client = new SseClient("http://localhost:3000/events");
		const events: unknown[] = [];
		const unsub = client.on("test", (data) => events.push(data));
		unsub();
		client.connect();
		mockEs.simulateEvent("test", JSON.stringify({ foo: "bar" }));
		expect(events).toHaveLength(0);
	});
});
