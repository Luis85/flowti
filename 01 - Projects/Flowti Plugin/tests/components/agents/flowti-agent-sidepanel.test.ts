// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";

describe("flowti-agent-sidepanel", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-agent-sidepanel")).toBeDefined();
	});

	it("renders empty state when no agents", async () => {
		el.agents = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No agents");
	});

	it("renders agent name when agents provided", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("atlas");
	});

	it("dispatches agent-selected event on agent click", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const shadow = el.shadowRoot!;
		const card = shadow.querySelector("[data-agent='atlas']") as HTMLElement;
		if (card) card.click();
		expect(detail).toEqual({ agent: "atlas" });
	});

	it("renders mode bar with three buttons", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const buttons = shadow.querySelectorAll(".mode-btn");
		expect(buttons.length).toBe(3);
	});

	it("renders conversation turns", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.turns = [
			{ id: "1", role: "user", content: "Hello", timestamp: "", mode: "conversational" },
			{ id: "2", role: "agent", agentName: "atlas", content: "Hi there!", timestamp: "", mode: "conversational" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Hello");
		expect(shadow.textContent).toContain("Hi there!");
	});

	it("renders input bar", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const textarea = shadow.querySelector("textarea");
		expect(textarea).toBeTruthy();
	});
});
