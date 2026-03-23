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

vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {},
	colorStyles: {},
	fontStyles: {},
	buttonStyles: {},
	scrollStyles: {},
}));

// Import triggers custom element registration
import "../../../src/game/ui/slide-panel.js";
import type { SlidePanel } from "../../../src/game/ui/slide-panel.js";

type SlidePanelElement = HTMLElement & {
	open: boolean;
	title: string;
	renderContent(): unknown;
	handleEscKey(e: KeyboardEvent): void;
	handleBackdropClick(): void;
	handleCloseClick(): void;
	emitClose(): void;
	connectedCallback(): void;
	disconnectedCallback(): void;
};

function createElement(): SlidePanelElement {
	return document.createElement("ft-game-slide-panel") as SlidePanelElement;
}

describe("SlidePanel (ft-game-slide-panel)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-slide-panel")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-slide-panel")).not.toThrow();
	});

	it("always renders panel structure (visibility controlled by CSS)", () => {
		const el = createElement();
		el.open = false;
		const result = el.renderContent() as { strings: TemplateStringsArray };
		expect(result.strings).toBeDefined();
	});

	it("renders panel structure when open is true", () => {
		const el = createElement();
		el.open = true;
		el.title = "Test Panel";
		const result = el.renderContent() as { strings: TemplateStringsArray; values: unknown[] };
		expect(result).toBeDefined();
		expect(result.strings).toBeDefined();
	});

	it("title prop renders in panel-title", () => {
		const el = createElement();
		el.open = true;
		el.title = "My Title";
		const result = el.renderContent() as { strings: TemplateStringsArray; values: unknown[] };
		// The panel template contains a nested html`` call for the .panel div.
		// The title value should appear somewhere in the values tree.
		const flatValues = JSON.stringify(result);
		expect(flatValues).toContain("My Title");
	});

	it("close button dispatches panel-close event", () => {
		const el = createElement();
		el.open = true;
		const handler = vi.fn();
		el.addEventListener("panel-close", handler);

		(el as unknown as { handleCloseClick(): void }).handleCloseClick();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("backdrop click dispatches panel-close event", () => {
		const el = createElement();
		el.open = true;
		const handler = vi.fn();
		el.addEventListener("panel-close", handler);

		(el as unknown as { handleBackdropClick(): void }).handleBackdropClick();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("Escape key dispatches panel-close event when open", () => {
		const el = createElement();
		el.open = true;
		const handler = vi.fn();
		el.addEventListener("panel-close", handler);

		(el as unknown as { handleEscKey(e: KeyboardEvent): void }).handleEscKey(
			new KeyboardEvent("keydown", { key: "Escape" }),
		);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("Escape key does not dispatch panel-close when closed", () => {
		const el = createElement();
		el.open = false;
		const handler = vi.fn();
		el.addEventListener("panel-close", handler);

		(el as unknown as { handleEscKey(e: KeyboardEvent): void }).handleEscKey(
			new KeyboardEvent("keydown", { key: "Escape" }),
		);
		expect(handler).not.toHaveBeenCalled();
	});

	it("panel-close event has bubbles and composed set to true", () => {
		const el = createElement();
		el.open = true;
		let capturedEvent: CustomEvent | null = null;
		el.addEventListener("panel-close", (e) => { capturedEvent = e as CustomEvent; });

		(el as unknown as { emitClose(): void }).emitClose();
		expect(capturedEvent).not.toBeNull();
		expect(capturedEvent!.bubbles).toBe(true);
		expect(capturedEvent!.composed).toBe(true);
	});

	it("has a slot for content projection", () => {
		const el = createElement();
		el.open = true;
		const result = el.renderContent() as { strings: TemplateStringsArray; values: unknown[] };
		const templateText = result.strings.join("");
		expect(templateText).toContain("<slot>");
	});

	it("connectedCallback adds keydown listener", () => {
		const addSpy = vi.spyOn(document, "addEventListener");
		const el = createElement();
		el.connectedCallback();
		expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
		addSpy.mockRestore();
	});

	it("disconnectedCallback removes keydown listener", () => {
		const removeSpy = vi.spyOn(document, "removeEventListener");
		const el = createElement();
		el.disconnectedCallback();
		expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
		removeSpy.mockRestore();
	});
});
