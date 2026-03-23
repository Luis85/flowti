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

vi.mock("../../../src/game/ui/portrait.js", () => ({
	renderPortrait: vi.fn((_name: string, _domain: string, _size: number, _tier?: string) => ({
		strings: ["<portrait-mock>"],
		values: [],
	})),
}));

// Stub side-effect child component registrations
vi.mock("../../../src/game/ui/slide-panel.js", () => ({}));
vi.mock("../../../src/game/ui/roster-panel.js", () => ({}));

// Import triggers custom element registration
import "../../../src/game/ui/sidebar.js";
import type { GameSidebar } from "../../../src/game/ui/sidebar.js";

type SidebarInternal = GameSidebar & {
	handleCouncilClick(agent: { name: string }): void;
	togglePanel(mode: string): void;
	handlePanelClose(): void;
	panelTitle(mode: string): string;
	renderPanel(): unknown;
	renderPanelContent(mode: string): unknown;
	councilAgents: ({ name: string } | null)[];
};

function createMockStore() {
	return {
		council: ["Alice", "Bob"],
		agents: [
			{ name: "Alice", agentType: "ai", status: "idle", domain: "engineering", trustTier: "trusted" },
			{ name: "Bob", agentType: "ai", status: "busy", domain: "design", trustTier: "supervised" },
		],
		selectedAgent: null as string | null,
		activePanel: null as string | null,
		briefingData: null as { results: unknown; narrativeText: string } | null,
		selectAgent: vi.fn(),
		setActivePanel: vi.fn(),
		stopFollow: vi.fn(),
		getAgentNeeds: vi.fn(() => ({ energy: 0.8, hunger: 0.6, thirst: 0.7, focus: 0.5, social: 0.9, morale: 0.7 })),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};
}

describe("GameSidebar (ft-game-sidebar)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-sidebar")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-sidebar")).not.toThrow();
	});

	it("computes 5 council slots (filled + empty based on store.council)", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		el.store = store;

		const slots = el.councilAgents;
		expect(slots).toHaveLength(5);
		expect(slots[0]?.name).toBe("Alice");
		expect(slots[1]?.name).toBe("Bob");
		expect(slots[2]).toBeNull();
		expect(slots[3]).toBeNull();
		expect(slots[4]).toBeNull();
	});

	it("council slot click calls store.selectAgent", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		el.store = store;

		el.handleCouncilClick({ name: "Alice" });
		expect(store.selectAgent).toHaveBeenCalledWith("Alice");
	});

	it("togglePanel toggles store.setActivePanel on", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = null;
		el.store = store;

		el.togglePanel("bob");
		expect(store.setActivePanel).toHaveBeenCalledWith("bob");
	});

	it("togglePanel toggles store.setActivePanel off when already active", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = "bob";
		el.store = store;

		el.togglePanel("bob");
		expect(store.setActivePanel).toHaveBeenCalledWith(null);
	});

	it("togglePanel switches to a different panel mode", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = "bob";
		el.store = store;

		el.togglePanel("roster");
		expect(store.setActivePanel).toHaveBeenCalledWith("roster");
	});

	it("handlePanelClose calls store.setActivePanel(null)", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = "roster";
		el.store = store;

		el.handlePanelClose();
		expect(store.setActivePanel).toHaveBeenCalledWith(null);
	});

	it("handlePanelClose calls store.stopFollow when closing agent-detail", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = "agent-detail";
		el.store = store;

		el.handlePanelClose();
		expect(store.stopFollow).toHaveBeenCalled();
		expect(store.setActivePanel).toHaveBeenCalledWith(null);
	});

	it("handlePanelClose does not call store.stopFollow for non-agent-detail panels", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = "bob";
		el.store = store;

		el.handlePanelClose();
		expect(store.stopFollow).not.toHaveBeenCalled();
		expect(store.setActivePanel).toHaveBeenCalledWith(null);
	});

	it("panelTitle returns correct title for each mode", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.selectedAgent = "Alice";
		el.store = store;

		expect(el.panelTitle("agent-detail")).toBe("Alice");
		expect(el.panelTitle("bob")).toBe("Ask Bob");
		expect(el.panelTitle("roster")).toBe("Council & Roster");
		expect(el.panelTitle("merchant")).toBe("Merchant");
		expect(el.panelTitle("briefing")).toBe("Welcome Back");
	});

	it("panelTitle returns 'Agent' when selectedAgent is null", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.selectedAgent = null;
		el.store = store;

		expect(el.panelTitle("agent-detail")).toBe("Agent");
	});

	it("renderPanel returns nothing when activePanel is null", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = null;
		el.store = store;

		const result = el.renderPanel();
		expect(typeof result).toBe("symbol");
	});

	it("renderPanel returns template when activePanel is set", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.activePanel = "roster";
		el.store = store;

		const result = el.renderPanel();
		expect(result).toBeDefined();
		expect(typeof result).not.toBe("symbol");
	});

	it("renderPanelContent returns template for each panel mode", () => {
		const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
		const store = createMockStore();
		store.briefingData = { results: {}, narrativeText: "Hello" };
		el.store = store;

		for (const mode of ["agent-detail", "bob", "roster", "merchant", "briefing"]) {
			const result = el.renderPanelContent(mode);
			expect(result).toBeDefined();
		}
	});
});
