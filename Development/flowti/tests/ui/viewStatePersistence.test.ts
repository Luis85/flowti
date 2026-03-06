// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../mocks/obsidian-stub";
import { BaseHubView, type IViewStateStore, type TabDef } from "../../src/ui/BaseHubView";
import type { IEventBus } from "../../src/infrastructure/events/types";
import type { WorkspaceLeaf } from "obsidian";

// ── Helpers ──────────────────────────────────────────────

function createMockEventBus(): IEventBus {
	return {
		on: vi.fn(() => () => {}),
		emit: vi.fn(),
	} as unknown as IEventBus;
}

/** Minimal concrete subclass for testing BaseHubView persistence. */
class TestHub extends BaseHubView<"tab-a" | "tab-b"> {
	public dashboardRendered = false;
	public lastTabRendered: string | null = null;

	getViewType() { return "flowti-test-hub"; }
	getHubId() { return "test-hub"; }
	getHubType() { return "domain" as const; }
	getHubDisplayName() { return "Test Hub"; }
	getHubIcon() { return "layout-grid"; }
	getTabDefinitions(): TabDef[] {
		return [
			{ id: "tab-a", label: "Tab A", icon: "file", searchPlaceholder: "Search A..." },
			{ id: "tab-b", label: "Tab B", icon: "folder", searchPlaceholder: "Search B..." },
		];
	}
	renderTopBarActions() {}
	onDashboardRender() { this.dashboardRendered = true; }
	onTabRender(tabId: string) { this.lastTabRendered = tabId; }
	onHubOpen() {}
	onHubClose() {}

	/** Expose for testing */
	getActivePagePublic() { return this.getActivePage(); }
	/** Expose protected navigateTo for testing */
	public navigateToPublic(page: "tab-a" | "tab-b" | "dashboard") { this.navigateTo(page); }
}

function createMockLeaf(): WorkspaceLeaf {
	return {} as WorkspaceLeaf;
}

/** Append the 2 children Obsidian creates (header + content area). */
function prepareContainerEl(view: TestHub): void {
	const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
	el.appendChild(document.createElement("div")); // [0] = header
	el.appendChild(document.createElement("div")); // [1] = content area
}

// ── Tests ────────────────────────────────────────────────

describe("View State Persistence", () => {
	let store: IViewStateStore;
	let storeMap: Map<string, string>;

	beforeEach(() => {
		storeMap = new Map();
		store = {
			get: (key: string) => storeMap.get(key),
			set: (key: string, value: string) => { storeMap.set(key, value); },
		};
		BaseHubView.setViewStateStore(store);
	});

	afterEach(() => {
		BaseHubView.setViewStateStore(null as unknown as IViewStateStore);
	});

	function createHub(bus?: IEventBus): TestHub {
		const hub = new TestHub(createMockLeaf(), bus ?? createMockEventBus());
		prepareContainerEl(hub);
		return hub;
	}

	it("navigateTo persists the active tab", async () => {
		const hub = createHub();
		await hub.onOpen();
		hub.navigateToPublic("tab-a");
		expect(storeMap.get("test-hub")).toBe("tab-a");
	});

	it("navigateTo updates store on each tab change", async () => {
		const hub = createHub();
		await hub.onOpen();
		hub.navigateToPublic("tab-a");
		expect(storeMap.get("test-hub")).toBe("tab-a");
		hub.navigateToPublic("tab-b");
		expect(storeMap.get("test-hub")).toBe("tab-b");
	});

	it("navigateTo to dashboard stores 'dashboard'", async () => {
		const hub = createHub();
		await hub.onOpen();
		hub.navigateToPublic("tab-a");
		hub.navigateToPublic("dashboard");
		expect(storeMap.get("test-hub")).toBe("dashboard");
	});

	it("onOpen restores persisted tab if valid", async () => {
		storeMap.set("test-hub", "tab-b");
		const hub = createHub();
		await hub.onOpen();
		expect(hub.getActivePagePublic()).toBe("tab-b");
	});

	it("onOpen defaults to dashboard when no stored tab", async () => {
		const hub = createHub();
		await hub.onOpen();
		expect(hub.getActivePagePublic()).toBe("dashboard");
		expect(hub.dashboardRendered).toBe(true);
	});

	it("onOpen defaults to dashboard when stored tab is 'dashboard'", async () => {
		storeMap.set("test-hub", "dashboard");
		const hub = createHub();
		await hub.onOpen();
		expect(hub.getActivePagePublic()).toBe("dashboard");
		expect(hub.dashboardRendered).toBe(true);
	});

	it("onOpen defaults to dashboard when stored tab is invalid", async () => {
		storeMap.set("test-hub", "nonexistent-tab");
		const hub = createHub();
		await hub.onOpen();
		expect(hub.getActivePagePublic()).toBe("dashboard");
		expect(hub.dashboardRendered).toBe(true);
	});

	it("different hubs maintain separate stored tabs", async () => {
		const bus = createMockEventBus();
		const hub1 = createHub(bus);
		await hub1.onOpen();
		hub1.navigateToPublic("tab-a");

		class TestHub2 extends TestHub {
			override getHubId() { return "other-hub"; }
		}
		const hub2 = new TestHub2(createMockLeaf(), bus);
		prepareContainerEl(hub2);
		await hub2.onOpen();
		hub2.navigateToPublic("tab-b");

		expect(storeMap.get("test-hub")).toBe("tab-a");
		expect(storeMap.get("other-hub")).toBe("tab-b");
	});

	it("works without a store (no-op)", async () => {
		BaseHubView.setViewStateStore(null as unknown as IViewStateStore);
		const hub = createHub();
		await hub.onOpen();
		hub.navigateToPublic("tab-a");
		expect(hub.getActivePagePublic()).toBe("tab-a");
	});

	it("IViewStateStore interface contract is satisfied by Map adapter", () => {
		expect(store.get("missing")).toBeUndefined();
		store.set("key", "value");
		expect(store.get("key")).toBe("value");
	});
});
