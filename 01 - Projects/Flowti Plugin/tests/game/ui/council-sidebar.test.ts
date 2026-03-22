// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// ── Lit mocks ─────────────────────────────────────────────────────────

vi.mock("lit", () => {
	class LitElement extends HTMLElement {
		static properties: Record<string, unknown> = {};
		static styles: unknown[] = [];
		connectedCallback() {}
		disconnectedCallback() {}
		requestUpdate() {}
	}
	return {
		LitElement,
		html: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
		css: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
		nothing: Symbol("nothing"),
	};
});

vi.mock("../../../src/components/flowti-element.js", () => {
	class FlowtiElement extends HTMLElement {
		static properties: Record<string, unknown> = {};
		static styles: unknown[] = [];
		connectedCallback() {}
		disconnectedCallback() {}
		requestUpdate() {}
		protected renderContent() { return null; }
	}
	if (!customElements.get("flowti-element")) {
		customElements.define("flowti-element", FlowtiElement);
	}
	return { FlowtiElement };
});

vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {},
	colorStyles: {},
	fontStyles: {},
	scrollStyles: {},
	buttonStyles: {},
}));

vi.mock("../../../src/game/sprites/character-pool.js", () => ({
	resolveCharacter: vi.fn(() => "NinjaBlue"),
}));

// Import triggers custom element registration
import "../../../src/game/ui/council-sidebar.js";

describe("CouncilSidebar (ft-game-council-sidebar)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-council-sidebar")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-council-sidebar")).not.toThrow();
	});
});
