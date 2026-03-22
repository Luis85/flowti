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
	buttonStyles: {},
}));

vi.mock("../../../src/game/sprites/character-pool.js", () => ({
	resolveCharacter: vi.fn(() => "NinjaBlue"),
}));

// Import triggers custom element registration
import "../../../src/game/ui/council-picker.js";

function createMockStore() {
	return {
		council: ["Alice"],
		agents: [
			{ name: "Alice", agentType: "ai", status: "idle", domain: "engineering" },
			{ name: "Bob", agentType: "ai", status: "busy", domain: "design" },
		],
		addToCouncil: vi.fn(),
		removeFromCouncil: vi.fn(),
		reorderCouncil: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};
}

describe("CouncilPicker (ft-game-council-picker)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-council-picker")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-council-picker")).not.toThrow();
	});

	it("handleAddAgent calls store.addToCouncil(name)", () => {
		const el = document.createElement("ft-game-council-picker") as HTMLElement & { store: ReturnType<typeof createMockStore> };
		const store = createMockStore();
		el.store = store;

		(el as unknown as { handleAddAgent(name: string): void }).handleAddAgent("Bob");
		expect(store.addToCouncil).toHaveBeenCalledWith("Bob");
	});

	it("handleRemoveAgent calls store.removeFromCouncil(name)", () => {
		const el = document.createElement("ft-game-council-picker") as HTMLElement & { store: ReturnType<typeof createMockStore> };
		const store = createMockStore();
		el.store = store;

		const fakeEvent = { stopPropagation: vi.fn() };
		(el as unknown as { handleRemoveAgent(name: string, e: Event): void }).handleRemoveAgent("Alice", fakeEvent as unknown as Event);
		expect(store.removeFromCouncil).toHaveBeenCalledWith("Alice");
		expect(fakeEvent.stopPropagation).toHaveBeenCalled();
	});

	it("Escape key dispatches close-picker event", () => {
		const el = document.createElement("ft-game-council-picker") as HTMLElement & { store: ReturnType<typeof createMockStore> };
		const store = createMockStore();
		el.store = store;

		const handler = vi.fn();
		el.addEventListener("close-picker", handler);

		// The component registers a keydown listener on document in connectedCallback.
		// Simulate by calling the private handleKeydown directly.
		(el as unknown as { handleKeydown: (e: KeyboardEvent) => void }).handleKeydown(
			new KeyboardEvent("keydown", { key: "Escape" }),
		);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("handleDragEnd resets dragSourceIndex", () => {
		const el = document.createElement("ft-game-council-picker") as HTMLElement & { store: ReturnType<typeof createMockStore> };
		const store = createMockStore();
		el.store = store;

		// Set a drag source first
		const inner = el as unknown as { dragSourceIndex: number; handleDragStart(index: number, e: DragEvent): void; handleDragEnd(): void };
		inner.dragSourceIndex = 2;
		inner.handleDragEnd();
		expect(inner.dragSourceIndex).toBe(-1);
	});
});
