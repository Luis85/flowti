// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-components.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-components", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-components") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-components")).toBeDefined();
	});

	it("renders component registry when components provided", async () => {
		el.components = [
			{ name: "Button", category: "UI", propCount: 5, slotCount: 1 },
			{ name: "Card", category: "Layout", propCount: 3, slotCount: 2 },
		];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Button");
		expect(el.shadowRoot!.textContent).toContain("Card");
	});

	it("shows empty state when no components", async () => {
		el.components = [];
		el.hasSitemap = true;
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Components (0)");
	});

	it("renders storybook section heading", async () => {
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Storybook");
	});
});
