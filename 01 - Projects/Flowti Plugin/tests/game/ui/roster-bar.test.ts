// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// ── Lit mocks ─────────────────────────────────────────────────────────

// Minimal LitElement stub that works in happy-dom without a full custom elements polyfill
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
	};
});

// Stub FlowtiElement so roster-bar only needs to define its own logic
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
}));

vi.mock("../../../src/game/config/domain-map.js", () => ({
	resolveSettingForDomain: vi.fn(() => "hub"),
}));

vi.mock("../../../src/game/config/settings.js", () => ({
	SCENE_THEMES: {
		hub: { label: "Hub" },
		office: { label: "Office" },
		village: { label: "Village" },
		station: { label: "Station" },
	},
}));

// Import triggers custom element registration
import "../../../src/game/ui/roster-bar.js";

describe("RosterBar (ft-game-roster-bar)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-roster-bar")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-roster-bar")).not.toThrow();
	});
});
