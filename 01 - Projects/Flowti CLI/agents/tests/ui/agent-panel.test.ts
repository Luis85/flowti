// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderAgentPanel } from "../../src/ui/agent-panel.js";
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

function makeOptions() {
	return {
		onClose: vi.fn(),
		sendMessage: vi.fn().mockResolvedValue({ ok: true }),
		assignTask: vi.fn().mockResolvedValue({ ok: true }),
		grantPermission: vi.fn().mockResolvedValue({ ok: true }),
		baseUrl: "http://localhost:3000",
		activityLog: [],
		permissions: [],
		pendingPermissions: [],
		currentPhase: "in-progress",
	};
}

describe("renderAgentPanel", () => {
	it("creates a DOM element with all 5 tabs", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const tabs = container.querySelectorAll(".agent-panel-tab");
		expect(tabs.length).toBe(5);

		const tabNames = Array.from(tabs).map((t) => t.textContent);
		expect(tabNames).toEqual(["Info", "Talk", "Tasks", "Permissions", "History"]);
	});

	it("shows the agent name and type in header", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const name = container.querySelector(".agent-panel-header-name");
		expect(name?.textContent).toBe("TestBot");

		const type = container.querySelector(".agent-panel-header-type");
		expect(type?.textContent).toBe("ai");
	});

	it("renders attributes grid", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const labels = container.querySelectorAll(".agent-panel-info-label");
		const labelTexts = Array.from(labels).map((l) => l.textContent);
		expect(labelTexts).toContain("STR");
		expect(labelTexts).toContain("INT");
	});

	it("renders mood, XP, and status in meta section", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const meta = container.querySelector(".agent-panel-meta");
		expect(meta?.textContent).toContain("Mood: focused");
		expect(meta?.textContent).toContain("XP: 42");
		expect(meta?.textContent).toContain("Status: idle");
	});

	it("tab switching changes visible content", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const content = container.querySelector(".agent-panel-content");
		const infoContent = content?.innerHTML;
		expect(infoContent).toBeTruthy();

		// Switch to Talk tab
		const tabs = container.querySelectorAll<HTMLButtonElement>(".agent-panel-tab");
		tabs[1].click();

		const talkContent = content?.innerHTML;
		expect(talkContent).not.toBe(infoContent);

		// Verify Talk tab has input
		const input = content?.querySelector("[data-testid='talk-input']");
		expect(input).not.toBeNull();
	});

	it("active tab has data-active=true", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const tabs = container.querySelectorAll<HTMLButtonElement>(".agent-panel-tab");

		// Info is active by default
		expect(tabs[0].getAttribute("data-active")).toBe("true");
		expect(tabs[1].getAttribute("data-active")).toBe("false");

		// Switch to Talk
		tabs[1].click();
		expect(tabs[0].getAttribute("data-active")).toBe("false");
		expect(tabs[1].getAttribute("data-active")).toBe("true");
	});

	it("close button calls the onClose callback", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderAgentPanel(container, makeAgent(), options);

		const closeBtn = container.querySelector<HTMLButtonElement>("[data-testid='panel-close']");
		expect(closeBtn).not.toBeNull();
		closeBtn!.click();
		expect(options.onClose).toHaveBeenCalledOnce();
	});

	it("renders Info tab content with persona, skills, and relationships", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const content = container.querySelector(".agent-panel-content");
		expect(content?.textContent).toContain("A diligent test agent.");
		expect(content?.textContent).toContain("TypeScript: expert");
		expect(content?.textContent).toContain("Alice (collaborator)");
	});

	it("switches between all tabs without error", () => {
		const container = document.createElement("div");
		renderAgentPanel(container, makeAgent(), makeOptions());

		const tabs = container.querySelectorAll<HTMLButtonElement>(".agent-panel-tab");
		for (const tab of tabs) {
			tab.click();
		}

		// After clicking History (last tab), it should be active
		expect(tabs[4].getAttribute("data-active")).toBe("true");
	});
});
