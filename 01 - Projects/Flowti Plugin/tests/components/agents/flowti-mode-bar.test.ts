// tests/components/agents/flowti-mode-bar.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-mode-bar.js";

describe("flowti-mode-bar", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-mode-bar") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-mode-bar")).toBeDefined();
	});

	it("renders three mode buttons", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const buttons = el.shadowRoot!.querySelectorAll(".mode-btn");
		expect(buttons.length).toBe(3);
		expect(buttons[0].textContent?.trim()).toBe("Doc");
		expect(buttons[1].textContent?.trim()).toBe("Chat");
		expect(buttons[2].textContent?.trim()).toBe("Canvas");
	});

	it("highlights the active mode", async () => {
		el.activeMode = "document";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const active = el.shadowRoot!.querySelector(".mode-btn--active") as HTMLElement;
		expect(active).not.toBeNull();
		expect(active.dataset.mode).toBe("document");
	});

	it("defaults to conversational mode", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const active = el.shadowRoot!.querySelector(".mode-btn--active") as HTMLElement;
		expect(active).not.toBeNull();
		expect(active.dataset.mode).toBe("conversational");
	});

	it("dispatches mode-changed on button click", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("mode-changed", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const docBtn = el.shadowRoot!.querySelector("[data-mode='document']") as HTMLElement;
		docBtn.click();
		expect(detail).toEqual({ mode: "document" });
	});

	it("dispatches mode-changed with canvas mode", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("mode-changed", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const canvasBtn = el.shadowRoot!.querySelector("[data-mode='canvas']") as HTMLElement;
		canvasBtn.click();
		expect(detail).toEqual({ mode: "canvas" });
	});

	it("uses role=tablist for accessibility", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const tablist = el.shadowRoot!.querySelector("[role='tablist']");
		expect(tablist).not.toBeNull();
		const tabs = el.shadowRoot!.querySelectorAll("[role='tab']");
		expect(tabs.length).toBe(3);
	});

	it("sets aria-selected on active tab", async () => {
		el.activeMode = "canvas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const canvasTab = el.shadowRoot!.querySelector("[data-mode='canvas']") as HTMLElement;
		expect(canvasTab.getAttribute("aria-selected")).toBe("true");
		const chatTab = el.shadowRoot!.querySelector("[data-mode='conversational']") as HTMLElement;
		expect(chatTab.getAttribute("aria-selected")).toBe("false");
	});
});
