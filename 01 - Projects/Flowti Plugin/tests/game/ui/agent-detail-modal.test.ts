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
		addController() {}
		protected renderContent() { return null; }
	}
	if (!customElements.get("flowti-element")) {
		customElements.define("flowti-element", FlowtiElement);
	}
	return { FlowtiElement };
});

vi.mock("../../../src/game/ui/store-controller.js", () => ({
	StoreController: class { constructor() {} hostConnected() {} hostDisconnected() {} },
}));

vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {},
	colorStyles: {},
	fontStyles: {},
	scrollStyles: {},
	buttonStyles: {},
}));

// ── Sub-component side-effect import mocks ────────────────────────────
vi.mock("../../../src/game/ui/panel-vitals.js", () => ({}));
vi.mock("../../../src/game/ui/panel-economy.js", () => ({}));
vi.mock("../../../src/game/ui/panel-talk.js", () => ({}));
vi.mock("../../../src/game/ui/panel-tasks.js", () => ({}));
vi.mock("../../../src/game/ui/panel-permissions.js", () => ({}));
vi.mock("../../../src/game/ui/panel-brain.js", () => ({}));
vi.mock("../../../src/game/ui/panel-debug.js", () => ({}));

// ── Import triggers custom element registration ──────────────────────
import "../../../src/game/ui/agent-detail-modal.js";

describe("AgentDetailModal (ft-game-agent-detail-modal)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-agent-detail-modal")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-agent-detail-modal")).not.toThrow();
	});
});
