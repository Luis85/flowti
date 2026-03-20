// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the game-styles module before importing the component
vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: [],
	colorStyles: [],
	fontStyles: [],
	scrollStyles: [],
	buttonStyles: [],
}));

import "../../../src/game/ui/panel-monitor.js";

function mockStore() {
	const store = new EventTarget() as EventTarget & Record<string, unknown>;
	store.agentStates = new Map([["atlas", "working"]]);
	store.llmStatus = new Map([["atlas", { state: "thinking", since: Date.now() }]]);
	store.agentPositions = new Map([["atlas", { x: 100, y: 200 }], ["bob", { x: 150, y: 220 }]]);
	store.agentEventLog = new Map([["atlas", [
		{ timestamp: Date.now() - 3000, type: "response", summary: "Hello there" },
		{ timestamp: Date.now() - 10000, type: "thinking", summary: "Thinking..." },
	]]]);
	store.taskLockedAgents = new Set();
	store.currentScene = "office";
	store.selectedTab = "monitor";
	store.agents = [{ name: "atlas", persona: "Atlas" }, { name: "bob", persona: "Bobby" }];
	store.isProcessAlive = vi.fn(() => true);
	return store;
}

describe("panel-monitor", () => {
	let el: HTMLElement & Record<string, unknown>;
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		el = document.createElement("ft-game-panel-monitor") as HTMLElement & Record<string, unknown>;
	});

	afterEach(() => {
		el.remove();
		container.remove();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-panel-monitor")).toBeDefined();
	});

	it("renders status grid with brain state", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("working");
	});

	it("renders process status", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("alive");
	});

	it("renders event stream entries", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Hello there");
		expect(el.shadowRoot!.textContent).toContain("response");
	});

	it("renders nearby agents", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Bobby");
	});

	it("shows scene name capitalized", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Office");
	});

	it("shows empty message when no events", async () => {
		const store = mockStore();
		store.agentEventLog = new Map();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("No events yet");
	});

	it("shows lock icon when task locked", async () => {
		const store = mockStore();
		(store.taskLockedAgents as Set<string>).add("atlas");
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		// Lock emoji should be in shadow DOM
		const html = el.shadowRoot!.innerHTML;
		expect(html).toContain("lock-icon");
	});
});
