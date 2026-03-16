// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import "../../src/ui/dashboard-overlays.js";

describe("dashboard-overlays", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("dashboard-overlays");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders no arrows when no agents are walking", () => {
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(0);
	});

	it("renders an arrow for a walking agent", async () => {
		store.updatePositions(new Map([["Bob", { x: 100, y: 200 }]]));
		store.setAgentTarget("Bob", { x: 300, y: 200 });
		await (el as any).updateComplete;
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(1);
	});

	it("hides arrow when agent has no target", async () => {
		store.updatePositions(new Map([["Bob", { x: 100, y: 200 }]]));
		// No target set — agentTargets map has no entry for Bob
		await (el as any).updateComplete;
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(0);
	});

	it("hides arrow when agent position and target are nearly identical", async () => {
		store.updatePositions(new Map([["Bob", { x: 100, y: 200 }]]));
		store.setAgentTarget("Bob", { x: 101, y: 200 });
		await (el as any).updateComplete;
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(0);
	});
});
