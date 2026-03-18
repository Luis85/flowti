// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";

describe("flowti-agent-sidepanel", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-agent-sidepanel")).toBeDefined();
	});

	it("renders empty state when no agents", async () => {
		el.agents = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("CLI server not connected");
	});

	it("composes child components when agents provided", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-agent-roster")).not.toBeNull();
		expect(shadow.querySelector("flowti-mode-bar")).not.toBeNull();
		expect(shadow.querySelector("flowti-conversational-mode")).not.toBeNull();
		expect(shadow.querySelector("flowti-input-bar")).not.toBeNull();
	});

	it("switches mode view based on activeMode", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.activeMode = "document";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-document-mode")).not.toBeNull();
		expect(shadow.querySelector("flowti-conversational-mode")).toBeNull();
	});

	it("renders canvas mode when activeMode is canvas", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.activeMode = "canvas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.querySelector("flowti-canvas-mode")).not.toBeNull();
	});

	it("bubbles agent-selected from roster", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const roster = el.shadowRoot!.querySelector("flowti-agent-roster") as HTMLElement;
		roster?.dispatchEvent(new CustomEvent("agent-selected", { detail: { agent: "atlas" }, bubbles: true, composed: true }));
		expect(detail).toEqual({ agent: "atlas" });
	});

	it("bubbles agent-send from input bar", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-send", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const inputBar = el.shadowRoot!.querySelector("flowti-input-bar") as HTMLElement;
		inputBar?.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "hello" }, bubbles: true, composed: true }));
		expect(detail).toEqual({ message: "hello" });
	});
});
