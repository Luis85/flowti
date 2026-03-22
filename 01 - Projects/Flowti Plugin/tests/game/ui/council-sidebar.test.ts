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

vi.mock("../../../src/game/ui/game-ui-constants.js", () => ({
	TRUST_TIER_COLORS: { supervised: "#f59e0b", trusted: "#22c55e", autonomous: "#8b5cf6" },
	STATUS_DOT_COLORS: { busy: "#22c55e", idle: "#3b82f6", unassigned: "#6b7280" },
}));

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

function createMockStore() {
	return {
		council: ["Alice", "Bob"],
		agents: [
			{ name: "Alice", agentType: "ai", status: "idle", domain: "engineering" },
			{ name: "Bob", agentType: "ai", status: "busy", domain: "design" },
		],
		selectedAgent: null,
		selectAgent: vi.fn(),
		getAgentNeeds: vi.fn(() => ({ energy: 0.8, hunger: 0.6, thirst: 0.7, focus: 0.5, social: 0.9, morale: 0.7 })),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};
}

describe("CouncilSidebar (ft-game-council-sidebar)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-council-sidebar")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-council-sidebar")).not.toThrow();
	});

	it("clicking a filled slot calls store.selectAgent(name)", () => {
		const el = document.createElement("ft-game-council-sidebar") as HTMLElement & { store: ReturnType<typeof createMockStore>; handleSlotClick: (agent: { name: string }) => void };
		const store = createMockStore();
		el.store = store;

		// Call the private handleSlotClick method directly
		(el as unknown as { handleSlotClick(agent: { name: string }): void }).handleSlotClick({ name: "Alice" });
		expect(store.selectAgent).toHaveBeenCalledWith("Alice");
	});

	it("clicking Manage button dispatches open-picker event", () => {
		const el = document.createElement("ft-game-council-sidebar") as HTMLElement & { store: ReturnType<typeof createMockStore> };
		const store = createMockStore();
		el.store = store;

		const handler = vi.fn();
		el.addEventListener("open-picker", handler);

		// Call the private handleManageClick method
		(el as unknown as { handleManageClick(): void }).handleManageClick();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("empty slot click dispatches open-picker event (via handleManageClick)", () => {
		const el = document.createElement("ft-game-council-sidebar") as HTMLElement & { store: ReturnType<typeof createMockStore> };
		const store = createMockStore();
		store.council = []; // all slots empty
		el.store = store;

		const handler = vi.fn();
		el.addEventListener("open-picker", handler);

		// Empty slots wire @click to handleManageClick
		(el as unknown as { handleManageClick(): void }).handleManageClick();
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
