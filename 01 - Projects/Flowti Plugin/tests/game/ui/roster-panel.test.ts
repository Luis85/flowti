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

vi.mock("../../../src/game/ui/portrait.js", () => ({
	renderPortrait: vi.fn(() => "<portrait>"),
}));

vi.mock("../../../src/game/config/domain-map.js", () => ({
	resolveSettingForDomain: vi.fn(() => "office"),
}));

// Import triggers custom element registration
import "../../../src/game/ui/roster-panel.js";

interface MockStore {
	council: string[];
	agents: Array<{ name: string; agentType: string; status: string; domain: string; trustTier?: string }>;
	addToCouncil: ReturnType<typeof vi.fn>;
	removeFromCouncil: ReturnType<typeof vi.fn>;
	reorderCouncil: ReturnType<typeof vi.fn>;
	selectAgent: ReturnType<typeof vi.fn>;
	changeScene: ReturnType<typeof vi.fn>;
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
}

function createMockStore(overrides?: Partial<MockStore>): MockStore {
	return {
		council: ["Alice"],
		agents: [
			{ name: "Alice", agentType: "ai", status: "idle", domain: "engineering", trustTier: "supervised" },
			{ name: "Bob", agentType: "ai", status: "busy", domain: "design" },
			{ name: "Charlie", agentType: "ai", status: "idle", domain: "engineering" },
			{ name: "Diana", agentType: "ai", status: "idle", domain: "management" },
		],
		addToCouncil: vi.fn(),
		removeFromCouncil: vi.fn(),
		reorderCouncil: vi.fn(),
		selectAgent: vi.fn(),
		changeScene: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		...overrides,
	};
}

type RosterPanelInstance = HTMLElement & {
	store: MockStore;
	searchQuery: string;
	dragSourceIndex: number;
	councilAgents: Array<{ name: string; domain?: string; trustTier?: string } | null>;
	councilNames: readonly string[];
	isFull: boolean;
	councilSet: Set<string>;
	filteredAgentsByDomain: Map<string, Array<{ name: string; domain?: string }>>;
	handleRemoveAgent(name: string, e: Event): void;
	handleAddAgent(name: string): void;
	handleAgentClick(agent: { name: string; domain?: string }): void;
	handleSearchInput(e: Event): void;
	handleDragStart(index: number, e: DragEvent): void;
	handleDragEnd(): void;
	handleDrop(targetIndex: number, e: DragEvent): void;
	renderContent(): unknown;
};

function createElement(): RosterPanelInstance {
	return document.createElement("ft-game-roster-panel") as RosterPanelInstance;
}

describe("RosterPanel (ft-game-roster-panel)", () => {
	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-roster-panel")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-roster-panel")).not.toThrow();
	});

	describe("council zone", () => {
		it("councilAgents returns 5 slots with filled and empty entries", () => {
			const el = createElement();
			const store = createMockStore({ council: ["Alice", "Bob"] });
			el.store = store;

			const slots = el.councilAgents;
			expect(slots).toHaveLength(5);
			expect(slots[0]).toEqual(store.agents[0]);
			expect(slots[1]).toEqual(store.agents[1]);
			expect(slots[2]).toBeNull();
			expect(slots[3]).toBeNull();
			expect(slots[4]).toBeNull();
		});

		it("returns all null slots when council is empty", () => {
			const el = createElement();
			el.store = createMockStore({ council: [] });

			const slots = el.councilAgents;
			expect(slots).toHaveLength(5);
			expect(slots.every(s => s === null)).toBe(true);
		});

		it("returns null for council names that do not match any agent", () => {
			const el = createElement();
			el.store = createMockStore({ council: ["Unknown"] });

			const slots = el.councilAgents;
			expect(slots[0]).toBeNull();
		});
	});

	describe("remove from council", () => {
		it("handleRemoveAgent calls store.removeFromCouncil(name)", () => {
			const el = createElement();
			const store = createMockStore();
			el.store = store;

			const fakeEvent = { stopPropagation: vi.fn() };
			el.handleRemoveAgent("Alice", fakeEvent as unknown as Event);
			expect(store.removeFromCouncil).toHaveBeenCalledWith("Alice");
			expect(fakeEvent.stopPropagation).toHaveBeenCalled();
		});
	});

	describe("agent list grouping", () => {
		it("filteredAgentsByDomain groups agents by domain", () => {
			const el = createElement();
			el.store = createMockStore();
			el.searchQuery = "";

			const grouped = el.filteredAgentsByDomain;
			expect(grouped.has("engineering")).toBe(true);
			expect(grouped.has("design")).toBe(true);
			expect(grouped.has("management")).toBe(true);
			expect(grouped.get("engineering")).toHaveLength(2);
			expect(grouped.get("design")).toHaveLength(1);
		});
	});

	describe("search filtering", () => {
		it("filters agents by name", () => {
			const el = createElement();
			el.store = createMockStore();
			el.searchQuery = "ali";

			const grouped = el.filteredAgentsByDomain;
			const allAgents = [...grouped.values()].flat();
			expect(allAgents).toHaveLength(1);
			expect(allAgents[0].name).toBe("Alice");
		});

		it("filters agents by domain", () => {
			const el = createElement();
			el.store = createMockStore();
			el.searchQuery = "design";

			const grouped = el.filteredAgentsByDomain;
			const allAgents = [...grouped.values()].flat();
			expect(allAgents).toHaveLength(1);
			expect(allAgents[0].name).toBe("Bob");
		});

		it("returns all agents when search is empty", () => {
			const el = createElement();
			el.store = createMockStore();
			el.searchQuery = "";

			const grouped = el.filteredAgentsByDomain;
			const allAgents = [...grouped.values()].flat();
			expect(allAgents).toHaveLength(4);
		});

		it("handleSearchInput updates searchQuery", () => {
			const el = createElement();
			el.store = createMockStore();
			el.handleSearchInput({ target: { value: "test" } } as unknown as Event);
			expect(el.searchQuery).toBe("test");
		});
	});

	describe("add to council", () => {
		it("handleAddAgent calls store.addToCouncil(name)", () => {
			const el = createElement();
			const store = createMockStore();
			el.store = store;

			el.handleAddAgent("Bob");
			expect(store.addToCouncil).toHaveBeenCalledWith("Bob");
		});

		it("isFull returns true when council has 5 members", () => {
			const el = createElement();
			el.store = createMockStore({ council: ["a", "b", "c", "d", "e"] });

			expect(el.isFull).toBe(true);
		});

		it("isFull returns false when council has fewer than 5 members", () => {
			const el = createElement();
			el.store = createMockStore({ council: ["a", "b"] });

			expect(el.isFull).toBe(false);
		});

		it("councilSet contains council member names", () => {
			const el = createElement();
			el.store = createMockStore({ council: ["Alice", "Bob"] });

			const set = el.councilSet;
			expect(set.has("Alice")).toBe(true);
			expect(set.has("Bob")).toBe(true);
			expect(set.has("Charlie")).toBe(false);
		});
	});

	describe("agent row click", () => {
		it("handleAgentClick calls store.changeScene and store.selectAgent", () => {
			const el = createElement();
			const store = createMockStore();
			el.store = store;

			el.handleAgentClick({ name: "Bob", domain: "design" });
			expect(store.changeScene).toHaveBeenCalled();
			expect(store.selectAgent).toHaveBeenCalledWith("Bob");
		});
	});

	describe("drag-reorder", () => {
		it("handleDragStart sets dragSourceIndex", () => {
			const el = createElement();
			el.store = createMockStore();

			const fakeEvent = { dataTransfer: { effectAllowed: "" } };
			el.handleDragStart(2, fakeEvent as unknown as DragEvent);
			expect(el.dragSourceIndex).toBe(2);
		});

		it("handleDragEnd resets dragSourceIndex", () => {
			const el = createElement();
			el.store = createMockStore();

			el.dragSourceIndex = 3;
			el.handleDragEnd();
			expect(el.dragSourceIndex).toBe(-1);
		});

		it("handleDrop reorders council and resets dragSourceIndex", () => {
			const el = createElement();
			const store = createMockStore({ council: ["Alice", "Bob", "Charlie"] });
			el.store = store;
			el.dragSourceIndex = 0;

			const fakeEvent = {
				preventDefault: vi.fn(),
				currentTarget: { classList: { remove: vi.fn() } },
			};
			el.handleDrop(2, fakeEvent as unknown as DragEvent);

			expect(store.reorderCouncil).toHaveBeenCalledWith(["Bob", "Charlie", "Alice"]);
			expect(el.dragSourceIndex).toBe(-1);
		});

		it("handleDrop ignores when source equals target", () => {
			const el = createElement();
			const store = createMockStore({ council: ["Alice", "Bob"] });
			el.store = store;
			el.dragSourceIndex = 1;

			const fakeEvent = {
				preventDefault: vi.fn(),
				currentTarget: { classList: { remove: vi.fn() } },
			};
			el.handleDrop(1, fakeEvent as unknown as DragEvent);

			expect(store.reorderCouncil).not.toHaveBeenCalled();
		});
	});

	describe("renderContent", () => {
		it("returns a template without error", () => {
			const el = createElement();
			el.store = createMockStore();
			el.searchQuery = "";

			expect(() => el.renderContent()).not.toThrow();
		});
	});
});
