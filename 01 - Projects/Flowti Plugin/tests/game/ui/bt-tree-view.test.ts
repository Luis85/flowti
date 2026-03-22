// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

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
}));

const importModule = async () => import("../../../src/game/ui/bt-tree-view.js");

describe("BtTreeView", () => {
	beforeEach(async () => {
		await importModule();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-bt-tree-view")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-bt-tree-view")).not.toThrow();
	});

	it("declares snapshot as a property", async () => {
		const mod = await importModule();
		const props = mod.BtTreeView.properties as Record<string, unknown>;
		expect(props).toHaveProperty("snapshot");
	});
});
