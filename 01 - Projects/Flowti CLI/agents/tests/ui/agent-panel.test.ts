// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import "../../src/ui/agent-panel.js";
import type { DashboardAgent } from "../../src/data/types.js";

function makeAgent(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "TestBot",
		agentType: "ai",
		status: "idle",
		mood: "focused",
		experience: 42,
		attributes: { str: 10, int: 14, wis: 12, cha: 8, dex: 11, con: 9 },
		skills: [{ name: "TypeScript", level: "expert" }],
		relationships: [{ target: "Alice", type: "collaborator" }],
		persona: "A diligent test agent.",
		...overrides,
	};
}

describe("agent-panel", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("agent-panel");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders nothing when no agent is selected", async () => {
		// selectedAgent is null by default
		await (el as any).updateComplete;
		const panel = el.shadowRoot!.querySelector("[data-testid='agent-panel']");
		expect(panel).toBeNull();
	});

	it("renders the panel when an agent is selected", async () => {
		store.setAgents([makeAgent()]);
		store.selectAgent("TestBot");
		await (el as any).updateComplete;

		const panel = el.shadowRoot!.querySelector("[data-testid='agent-panel']");
		expect(panel).not.toBeNull();

		const nameEl = el.shadowRoot!.querySelector("[data-testid='panel-agent-name']");
		expect(nameEl?.textContent).toBe("A diligent test agent.");
	});

	it("renders 5 tab buttons", async () => {
		store.setAgents([makeAgent()]);
		store.selectAgent("TestBot");
		await (el as any).updateComplete;

		const tabs = el.shadowRoot!.querySelectorAll(".tab-btn");
		expect(tabs.length).toBe(5);

		const labels = Array.from(tabs).map((t) => t.textContent?.trim());
		expect(labels).toEqual(["Info", "Talk", "Tasks", "Permissions", "History"]);
	});

	it("shows info tab as active by default", async () => {
		store.setAgents([makeAgent()]);
		store.selectAgent("TestBot");
		await (el as any).updateComplete;

		const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".tab-btn");
		expect(tabs[0].getAttribute("data-active")).toBe("true");
		expect(tabs[1].getAttribute("data-active")).toBe("false");
	});

	it("switches displayed tab when store.selectedTab changes", async () => {
		store.setAgents([makeAgent()]);
		store.selectAgent("TestBot");
		await (el as any).updateComplete;

		// Default: info tab active
		let activeTab = el.shadowRoot!.querySelector<HTMLButtonElement>("[data-active='true']");
		expect(activeTab?.getAttribute("data-tab")).toBe("info");

		// Switch to talk
		store.selectTab("talk");
		await (el as any).updateComplete;

		activeTab = el.shadowRoot!.querySelector<HTMLButtonElement>("[data-active='true']");
		expect(activeTab?.getAttribute("data-tab")).toBe("talk");

		// Switch to history
		store.selectTab("history");
		await (el as any).updateComplete;

		activeTab = el.shadowRoot!.querySelector<HTMLButtonElement>("[data-active='true']");
		expect(activeTab?.getAttribute("data-tab")).toBe("history");
	});

	it("close button calls store.selectAgent(null)", async () => {
		store.setAgents([makeAgent()]);
		store.selectAgent("TestBot");
		await (el as any).updateComplete;

		const closeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>("[data-testid='panel-close']");
		expect(closeBtn).not.toBeNull();
		closeBtn!.click();
		await (el as any).updateComplete;

		expect(store.selectedAgent).toBeNull();

		// Panel should be gone
		const panel = el.shadowRoot!.querySelector("[data-testid='agent-panel']");
		expect(panel).toBeNull();
	});

	it("renders nothing when agent name is not found in store.agents", async () => {
		// Select an agent that doesn't exist in agents array
		store.selectAgent("GhostBot");
		await (el as any).updateComplete;

		const panel = el.shadowRoot!.querySelector("[data-testid='agent-panel']");
		expect(panel).toBeNull();
	});

	it("displays the agent type badge", async () => {
		store.setAgents([makeAgent({ agentType: "human" })]);
		store.selectAgent("TestBot");
		await (el as any).updateComplete;

		const badge = el.shadowRoot!.querySelector(".agent-type-badge");
		expect(badge?.textContent?.trim()).toBe("human");
	});
});
