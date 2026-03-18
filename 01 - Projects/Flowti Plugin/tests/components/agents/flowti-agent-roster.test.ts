// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/agents/flowti-agent-roster.js";

describe("flowti-agent-roster", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-agent-roster") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-agent-roster")).toBeDefined();
	});

	it("renders empty state when no agents", async () => {
		el.agents = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No agents");
	});

	it("renders agent cards for each agent", async () => {
		el.agents = [
			{ name: "atlas", persona: "Atlas", activity: "idle" },
			{ name: "vex", persona: "Vex", activity: "thinking" },
		];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".agent-card");
		expect(cards.length).toBe(2);
	});

	it("renders persona name as primary and agent slug as secondary", async () => {
		el.agents = [{ name: "atlas", persona: "Atlas the Wise", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Atlas the Wise");
		expect(shadow.textContent).toContain("atlas");
	});

	it("renders agent name when persona is absent", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const nameEl = shadow.querySelector(".agent-name");
		expect(nameEl?.textContent).toContain("atlas");
	});

	it("renders avatar with first letter of persona", async () => {
		el.agents = [{ name: "atlas", persona: "Atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const avatar = shadow.querySelector(".agent-avatar");
		expect(avatar?.textContent?.trim()).toBe("A");
	});

	it("applies activity class to avatar", async () => {
		el.agents = [{ name: "atlas", activity: "thinking" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const avatar = shadow.querySelector(".agent-avatar");
		expect(avatar?.classList.contains("agent-avatar--thinking")).toBe(true);
	});

	it("highlights the active agent card", async () => {
		el.agents = [
			{ name: "atlas", activity: "idle" },
			{ name: "vex", activity: "idle" },
		];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const active = shadow.querySelector("[data-agent='atlas']");
		expect(active?.classList.contains("agent-card--active")).toBe(true);
		const inactive = shadow.querySelector("[data-agent='vex']");
		expect(inactive?.classList.contains("agent-card--active")).toBe(false);
	});

	it("renders mood text when provided", async () => {
		el.agents = [{ name: "atlas", persona: "Atlas", mood: "curious", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("curious");
	});

	it("does not render mood when absent", async () => {
		el.agents = [{ name: "atlas", persona: "Atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const mood = shadow.querySelector(".agent-mood");
		expect(mood).toBeNull();
	});

	it("renders INT and CHA stat badges when provided", async () => {
		el.agents = [{ name: "atlas", persona: "Atlas", intStat: 14, chaStat: 12, activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const stats = shadow.querySelectorAll(".agent-stat");
		expect(stats.length).toBe(2);
		expect(shadow.textContent).toContain("INT 14");
		expect(shadow.textContent).toContain("CHA 12");
	});

	it("does not render stat badges when stats absent", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const stats = shadow.querySelectorAll(".agent-stat");
		expect(stats.length).toBe(0);
	});

	it("dispatches agent-selected event on agent card click", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const shadow = el.shadowRoot!;
		const card = shadow.querySelector("[data-agent='atlas']") as HTMLElement;
		card.click();
		expect(detail).toEqual({ agent: "atlas" });
	});

	it("renders team toggle switch", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const toggle = shadow.querySelector(".team-toggle");
		expect(toggle).toBeTruthy();
	});

	it("dispatches team-toggled event when toggle is clicked", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.teamMode = false;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("team-toggled", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const shadow = el.shadowRoot!;
		const toggle = shadow.querySelector(".team-toggle input") as HTMLElement;
		toggle.click();
		expect(detail).toEqual({ enabled: true });
	});

	it("reflects teamMode property in toggle state", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.teamMode = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const input = shadow.querySelector(".team-toggle input") as HTMLInputElement;
		expect(input.checked).toBe(true);
	});

	it("shows team badge on cards when teamMode is on", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.teamMode = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".team-badge");
		expect(badge).toBeTruthy();
	});

	it("hides team badge on cards when teamMode is off", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.teamMode = false;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".team-badge");
		expect(badge).toBeNull();
	});
});
