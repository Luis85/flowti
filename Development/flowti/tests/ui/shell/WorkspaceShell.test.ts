// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkspaceShell } from "../../../src/ui/shell/WorkspaceShell";
import type { ShellConfig } from "../../../src/ui/shell/types";
import type { TabDef } from "../../../src/ui/BaseHubView";

// ── Helpers ─────────────────────────────────────────────────

function makeWrapper(): HTMLElement {
	const el = document.createElement("div");
	// Polyfill Obsidian DOM extensions (from obsidian-stub)
	return el;
}

function makeConfig(overrides: Partial<ShellConfig> = {}): ShellConfig {
	return {
		hubName: "Test Hub",
		onNavigateDashboard: vi.fn(),
		renderTopBarActions: vi.fn(),
		...overrides,
	};
}

const testTabs: TabDef[] = [
	{ id: "events", label: "Events", icon: "activity", searchPlaceholder: "Search events..." },
	{ id: "systems", label: "Systems", icon: "server", searchPlaceholder: "Search systems..." },
	{ id: "actors", label: "Actors", icon: "users", searchPlaceholder: "Search actors..." },
];

// ── Shell Mount ─────────────────────────────────────────────

describe("WorkspaceShell", () => {
	let wrapper: HTMLElement;

	beforeEach(() => {
		wrapper = makeWrapper();
	});

	describe("mount", () => {
		it("creates top bar and tab bar elements", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			expect(els.topBarEl).toBeDefined();
			expect(els.topBarTitleEl).toBeDefined();
			expect(els.countBadge).toBeDefined();
			expect(els.tabBarEl).toBeDefined();
		});

		it("top bar contains hub name", () => {
			const shell = new WorkspaceShell(makeConfig({ hubName: "Event Catalog" }));
			const els = shell.mount(wrapper);

			expect(els.topBarTitleEl.textContent).toBe("Event Catalog");
		});

		it("top bar starts hidden", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			expect(els.topBarEl.classList.contains("ft-hidden")).toBe(true);
		});

		it("tab bar starts hidden", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			expect(els.tabBarEl.classList.contains("ft-hidden")).toBe(true);
		});

		it("calls renderTopBarActions with bar element", () => {
			const renderActions = vi.fn();
			const shell = new WorkspaceShell(makeConfig({ renderTopBarActions: renderActions }));
			shell.mount(wrapper);

			expect(renderActions).toHaveBeenCalledTimes(1);
			expect(renderActions).toHaveBeenCalledWith(expect.any(HTMLElement));
		});

		it("title click triggers onNavigateDashboard", () => {
			const onNavigate = vi.fn();
			const shell = new WorkspaceShell(makeConfig({ onNavigateDashboard: onNavigate }));
			const els = shell.mount(wrapper);

			els.topBarTitleEl.click();
			expect(onNavigate).toHaveBeenCalledTimes(1);
		});

		it("count badge starts hidden", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			expect(els.countBadge.classList.contains("ft-hidden")).toBe(true);
		});
	});

	describe("renderTabBar", () => {
		it("renders tab buttons from TabDef array", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			shell.renderTabBar(testTabs, "events", vi.fn());
			expect(els.tabBarEl.children.length).toBe(3);
		});

		it("marks active tab with active class", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			shell.renderTabBar(testTabs, "systems", vi.fn());
			const buttons = Array.from(els.tabBarEl.children) as HTMLElement[];
			expect(buttons[0].classList.contains("ft-catalog-tab-active")).toBe(false);
			expect(buttons[1].classList.contains("ft-catalog-tab-active")).toBe(true);
			expect(buttons[2].classList.contains("ft-catalog-tab-active")).toBe(false);
		});

		it("clicking a tab triggers onTabClick callback", () => {
			const onTabClick = vi.fn();
			const shell = new WorkspaceShell(makeConfig());
			shell.mount(wrapper);

			shell.renderTabBar(testTabs, "events", onTabClick);
			const buttons = Array.from(shell["tabBarEl"]!.children) as HTMLElement[];
			buttons[1].click(); // click "systems"
			expect(onTabClick).toHaveBeenCalledWith("systems");
		});

		it("clicking the already-active tab is a no-op", () => {
			const onTabClick = vi.fn();
			const shell = new WorkspaceShell(makeConfig());
			shell.mount(wrapper);

			shell.renderTabBar(testTabs, "events", onTabClick);
			const buttons = Array.from(shell["tabBarEl"]!.children) as HTMLElement[];
			buttons[0].click(); // click already-active "events"
			expect(onTabClick).not.toHaveBeenCalled();
		});

		it("re-renders correctly with new active tab", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			shell.renderTabBar(testTabs, "events", vi.fn());
			shell.renderTabBar(testTabs, "actors", vi.fn());

			const buttons = Array.from(els.tabBarEl.children) as HTMLElement[];
			expect(buttons[0].classList.contains("ft-catalog-tab-active")).toBe(false);
			expect(buttons[2].classList.contains("ft-catalog-tab-active")).toBe(true);
		});

		it("renders empty tab bar with no tabs", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			shell.renderTabBar([], "dashboard", vi.fn());
			expect(els.tabBarEl.children.length).toBe(0);
		});
	});

	describe("dispose", () => {
		it("clears internal references", () => {
			const shell = new WorkspaceShell(makeConfig());
			shell.mount(wrapper);

			shell.dispose();
			// renderTabBar should be safe to call after dispose (no-op)
			expect(() => shell.renderTabBar(testTabs, "events", vi.fn())).not.toThrow();
		});
	});

	describe("edge cases", () => {
		it("works with single tab", () => {
			const shell = new WorkspaceShell(makeConfig());
			const els = shell.mount(wrapper);

			const singleTab: TabDef[] = [{ id: "only", label: "Only Tab", icon: "star", searchPlaceholder: "Search..." }];
			shell.renderTabBar(singleTab, "only", vi.fn());
			expect(els.tabBarEl.children.length).toBe(1);
			expect((els.tabBarEl.children[0] as HTMLElement).classList.contains("ft-catalog-tab-active")).toBe(true);
		});
	});
});
