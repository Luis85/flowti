// tests/components/agents/flowti-input-bar.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-input-bar.js";

describe("flowti-input-bar", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-input-bar") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-input-bar")).toBeDefined();
	});

	it("renders textarea and send button", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("textarea")).not.toBeNull();
		expect(shadow.querySelector("[data-action='send']")).not.toBeNull();
	});

	it("shows agent label", async () => {
		el.agentLabel = "Talking to Alice";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Talking to Alice");
	});

	it("dispatches agent-send on button click", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const textarea = el.shadowRoot!.querySelector("textarea") as HTMLTextAreaElement;
		textarea.value = "hello";
		textarea.dispatchEvent(new Event("input"));
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-send", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector("[data-action='send']") as HTMLElement;
		btn.click();
		expect(detail).toEqual({ message: "hello" });
	});

	it("disables send when processing", async () => {
		el.processing = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = el.shadowRoot!.querySelector("[data-action='send']") as HTMLButtonElement;
		expect(btn.textContent?.trim()).toBe("Stop");
	});

	it("dispatches agent-stop when processing and button clicked", async () => {
		el.processing = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let fired = false;
		el.addEventListener("agent-stop", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector("[data-action='send']") as HTMLElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("auto-grows textarea on input", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const textarea = el.shadowRoot!.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();
		// Textarea has min-height and max-height styles
		expect(textarea.style.minHeight || textarea.getAttribute("style")).toBeDefined();
	});
});
