// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import "../../src/ui/camera-hud.js";

/** Flush RAF-deferred store notifications, then wait for Lit update. */
async function flushStore(el: HTMLElement): Promise<void> {
	await new Promise((r) => requestAnimationFrame(r));
	await (el as any).updateComplete;
}

describe("camera-hud", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("camera-hud");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders nothing when not following any agent", () => {
		const hud = el.shadowRoot!.querySelector(".hud");
		expect(hud).toBeNull();
	});

	it("shows agent name when following an agent", async () => {
		store.startFollow("AlphaBot");
		await flushStore(el);

		const hud = el.shadowRoot!.querySelector(".hud");
		expect(hud).not.toBeNull();

		const agentName = el.shadowRoot!.querySelector(".agent-name");
		expect(agentName?.textContent).toBe("AlphaBot");
	});

	it("hides the HUD again after stopFollow is called", async () => {
		store.startFollow("AlphaBot");
		await flushStore(el);

		store.stopFollow();
		await flushStore(el);

		const hud = el.shadowRoot!.querySelector(".hud");
		expect(hud).toBeNull();
	});

	it("calls stopFollow when close button is clicked", async () => {
		store.startFollow("BetaBot");
		await flushStore(el);

		const stopFollow = vi.spyOn(store, "stopFollow");

		const closeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>(".close-btn");
		expect(closeBtn).not.toBeNull();
		closeBtn!.click();

		expect(stopFollow).toHaveBeenCalledOnce();
	});

	it("displays the label 'Following:' alongside the agent name", async () => {
		store.startFollow("GammaBot");
		await flushStore(el);

		const label = el.shadowRoot!.querySelector(".label");
		expect(label?.textContent).toBe("Following:");

		const agentName = el.shadowRoot!.querySelector(".agent-name");
		expect(agentName?.textContent).toBe("GammaBot");
	});
});
