// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import "../../src/ui/roster-bar.js";
import type { DashboardAgent } from "../../src/data/types.js";

function makeAgent(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "TestBot",
		agentType: "ai",
		status: "idle",
		...overrides,
	};
}

describe("roster-bar", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("roster-bar");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders no cards when all agents are hub agents", async () => {
		// domain=undefined resolves to "hub" — should not appear
		store.setAgents([
			makeAgent({ name: "HubBot", domain: undefined }),
		]);
		await (el as any).updateComplete;

		const cards = el.shadowRoot!.querySelectorAll(".card");
		expect(cards.length).toBe(0);
	});

	it("renders cards only for domain-assigned agents", async () => {
		store.setAgents([
			makeAgent({ name: "EngineerBot", domain: "engineering" }), // resolves to "office"
			makeAgent({ name: "HubBot", domain: undefined }),           // resolves to "hub"
		]);
		await (el as any).updateComplete;

		const cards = el.shadowRoot!.querySelectorAll(".card");
		expect(cards.length).toBe(1);

		const nameEl = el.shadowRoot!.querySelector(".agent-name");
		expect(nameEl?.textContent).toBe("Engineer\u2026");
	});

	it("shows location label from SCENE_THEMES", async () => {
		store.setAgents([
			makeAgent({ name: "DesignBot", domain: "design" }), // resolves to "village"
		]);
		await (el as any).updateComplete;

		const locEl = el.shadowRoot!.querySelector(".agent-location");
		expect(locEl?.textContent).toBe("Village");
	});

	it("renders status dot with correct color for busy agent", async () => {
		store.setAgents([
			makeAgent({ name: "BusyBot", domain: "qa", status: "busy" }),
		]);
		await (el as any).updateComplete;

		const dot = el.shadowRoot!.querySelector(".status-dot") as HTMLElement;
		expect(dot?.style.background).toBe("rgb(34, 197, 94)");
	});

	it("does not render hub agents (domain='general')", async () => {
		store.setAgents([
			makeAgent({ name: "GeneralBot", domain: "general" }), // maps to "hub"
		]);
		await (el as any).updateComplete;

		const cards = el.shadowRoot!.querySelectorAll(".card");
		expect(cards.length).toBe(0);
	});

	it("card click calls store.changeScene with the correct setting", async () => {
		store.setAgents([
			makeAgent({ name: "ManageBot", domain: "management" }), // resolves to "station"
		]);
		await (el as any).updateComplete;

		const sceneChanges: string[] = [];
		store.addEventListener("scene-change", (e) => {
			sceneChanges.push((e as CustomEvent).detail.setting);
		});

		const card = el.shadowRoot!.querySelector(".card") as HTMLElement;
		card.click();

		expect(sceneChanges).toEqual(["station"]);
	});

	it("renders multiple domain-assigned agents", async () => {
		store.setAgents([
			makeAgent({ name: "EngineerBot", domain: "engineering" }),
			makeAgent({ name: "DesignerBot", domain: "design" }),
			makeAgent({ name: "HubBot", domain: undefined }),
		]);
		await (el as any).updateComplete;

		const cards = el.shadowRoot!.querySelectorAll(".card");
		expect(cards.length).toBe(2);
	});

	it("truncates long agent names with ellipsis", async () => {
		store.setAgents([
			makeAgent({ name: "VeryLongAgentName", domain: "engineering" }),
		]);
		await (el as any).updateComplete;

		const nameEl = el.shadowRoot!.querySelector(".agent-name");
		expect(nameEl?.textContent).toBe("VeryLong\u2026");
	});

	it("does not truncate short agent names", async () => {
		store.setAgents([
			makeAgent({ name: "Short", domain: "engineering" }),
		]);
		await (el as any).updateComplete;

		const nameEl = el.shadowRoot!.querySelector(".agent-name");
		expect(nameEl?.textContent).toBe("Short");
	});
});
