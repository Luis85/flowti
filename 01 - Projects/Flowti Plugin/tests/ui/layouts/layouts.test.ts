// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { SinglePaneLayout } from "../../../src/ui/layouts/SinglePaneLayout";
import { SplitLayout } from "../../../src/ui/layouts/SplitLayout";
import { TabbedLayout } from "../../../src/ui/layouts/TabbedLayout";
import { StackedLayout } from "../../../src/ui/layouts/StackedLayout";
import { LayoutRegistry } from "../../../src/ui/layouts/LayoutRegistry";
import type { ILayout } from "../../../src/ui/layouts/types";

// ── Helpers ─────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	return document.createElement("div");
}

// ── SinglePaneLayout ────────────────────────────────────────

describe("SinglePaneLayout", () => {
	let container: HTMLElement;
	let layout: SinglePaneLayout;

	beforeEach(() => {
		container = makeContainer();
		layout = new SinglePaneLayout();
	});

	it("has type 'single'", () => {
		expect(layout.type).toBe("single");
	});

	it("mount creates DOM structure", () => {
		layout.mount(container);
		expect(container.children.length).toBe(1);
		expect(container.children[0].classList.contains("ft-layout-single")).toBe(true);
	});

	it("getRegion returns content region after mount", () => {
		layout.mount(container);
		const region = layout.getRegion("content");
		expect(region).not.toBeNull();
		expect(region!.el.classList.contains("ft-layout-content")).toBe(true);
	});

	it("getRegion returns null for unknown region", () => {
		layout.mount(container);
		expect(layout.getRegion("unknown")).toBeNull();
	});

	it("getRegion returns null before mount", () => {
		expect(layout.getRegion("content")).toBeNull();
	});

	it("dispose removes DOM nodes", () => {
		layout.mount(container);
		expect(container.children.length).toBe(1);
		layout.dispose();
		expect(container.children.length).toBe(0);
	});

	it("dispose clears region references", () => {
		layout.mount(container);
		layout.dispose();
		expect(layout.getRegion("content")).toBeNull();
	});

	it("content injected into region is accessible", () => {
		layout.mount(container);
		const region = layout.getRegion("content")!;
		const child = document.createElement("span");
		child.textContent = "hello";
		region.el.appendChild(child);
		expect(region.el.children.length).toBe(1);
		expect(region.el.textContent).toBe("hello");
	});
});

// ── SplitLayout ─────────────────────────────────────────────

describe("SplitLayout", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = makeContainer();
	});

	it("has type 'split'", () => {
		const layout = new SplitLayout();
		expect(layout.type).toBe("split");
	});

	it("mount creates primary and inspector regions", () => {
		const layout = new SplitLayout();
		layout.mount(container);

		expect(layout.getRegion("primary")).not.toBeNull();
		expect(layout.getRegion("inspector")).not.toBeNull();
		expect(layout.getRegion("unknown")).toBeNull();
	});

	it("default ratio is 30%", () => {
		const layout = new SplitLayout();
		layout.mount(container);
		const root = container.children[0] as HTMLElement;
		expect(root.style.getPropertyValue("--ft-split-ratio")).toBe("30%");
	});

	it("configurable ratio is applied", () => {
		const layout = new SplitLayout({ ratio: 0.5 });
		layout.mount(container);
		const root = container.children[0] as HTMLElement;
		expect(root.style.getPropertyValue("--ft-split-ratio")).toBe("50%");
	});

	it("dispose removes DOM and clears regions", () => {
		const layout = new SplitLayout();
		layout.mount(container);
		layout.dispose();
		expect(container.children.length).toBe(0);
		expect(layout.getRegion("primary")).toBeNull();
		expect(layout.getRegion("inspector")).toBeNull();
	});
});

// ── TabbedLayout ────────────────────────────────────────────

describe("TabbedLayout", () => {
	let container: HTMLElement;

	const tabs = [
		{ id: "alpha", label: "Alpha" },
		{ id: "beta", label: "Beta" },
		{ id: "gamma", label: "Gamma" },
	];

	beforeEach(() => {
		container = makeContainer();
	});

	it("has type 'tabbed'", () => {
		const layout = new TabbedLayout({ tabs });
		expect(layout.type).toBe("tabbed");
	});

	it("mount creates tab bar and content panels", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);

		const tabBar = layout.getRegion("tabs")!;
		expect(tabBar).not.toBeNull();
		expect(tabBar.el.children.length).toBe(3);
	});

	it("first tab is active by default after mount", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);
		expect(layout.getActiveTabId()).toBe("alpha");
	});

	it("content region returns active tab panel", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);
		const content = layout.getRegion("content");
		expect(content).not.toBeNull();
		expect(content!.el.dataset.tabId).toBe("alpha");
	});

	it("switchTab changes active panel visibility", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);

		layout.switchTab("beta");
		expect(layout.getActiveTabId()).toBe("beta");

		const alphaPanel = layout.getTabPanel("alpha")!;
		const betaPanel = layout.getTabPanel("beta")!;
		expect(alphaPanel.classList.contains("ft-hidden")).toBe(true);
		expect(betaPanel.classList.contains("ft-hidden")).toBe(false);
	});

	it("switchTab updates active button styling", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);

		layout.switchTab("gamma");
		const tabBar = layout.getRegion("tabs")!;
		const buttons = Array.from(tabBar.el.children) as HTMLElement[];
		expect(buttons[0].classList.contains("ft-layout-tab-active")).toBe(false);
		expect(buttons[2].classList.contains("ft-layout-tab-active")).toBe(true);
	});

	it("switchTab with unknown id is a no-op", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);
		layout.switchTab("nonexistent");
		expect(layout.getActiveTabId()).toBe("alpha");
	});

	it("content survives tab switch round-trip", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);

		// Add content to alpha
		const alphaPanel = layout.getTabPanel("alpha")!;
		const child = document.createElement("span");
		child.textContent = "persistent";
		alphaPanel.appendChild(child);

		// Switch away and back
		layout.switchTab("beta");
		layout.switchTab("alpha");

		expect(alphaPanel.textContent).toBe("persistent");
	});

	it("getTabPanel returns null for unknown tab", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);
		expect(layout.getTabPanel("unknown")).toBeNull();
	});

	it("dispose clears all state", () => {
		const layout = new TabbedLayout({ tabs });
		layout.mount(container);
		layout.dispose();
		expect(container.children.length).toBe(0);
		expect(layout.getRegion("tabs")).toBeNull();
		expect(layout.getRegion("content")).toBeNull();
		expect(layout.getActiveTabId()).toBeNull();
	});

	it("mount with empty tabs creates tab bar with no buttons", () => {
		const layout = new TabbedLayout({ tabs: [] });
		layout.mount(container);
		const tabBar = layout.getRegion("tabs")!;
		expect(tabBar.el.children.length).toBe(0);
		expect(layout.getActiveTabId()).toBeNull();
	});
});

// ── StackedLayout ───────────────────────────────────────────

describe("StackedLayout", () => {
	let container: HTMLElement;

	const sections = [
		{ id: "header" },
		{ id: "body" },
		{ id: "footer" },
	];

	beforeEach(() => {
		container = makeContainer();
	});

	it("has type 'stacked'", () => {
		const layout = new StackedLayout({ sections });
		expect(layout.type).toBe("stacked");
	});

	it("mount creates section elements in order", () => {
		const layout = new StackedLayout({ sections });
		layout.mount(container);

		const root = container.children[0];
		expect(root.children.length).toBe(3);

		const ids = Array.from(root.children).map((c) => (c as HTMLElement).dataset.sectionId);
		expect(ids).toEqual(["header", "body", "footer"]);
	});

	it("getRegion returns section by id", () => {
		const layout = new StackedLayout({ sections });
		layout.mount(container);

		expect(layout.getRegion("header")).not.toBeNull();
		expect(layout.getRegion("body")).not.toBeNull();
		expect(layout.getRegion("footer")).not.toBeNull();
		expect(layout.getRegion("unknown")).toBeNull();
	});

	it("dispose removes all DOM and clears state", () => {
		const layout = new StackedLayout({ sections });
		layout.mount(container);
		layout.dispose();
		expect(container.children.length).toBe(0);
		expect(layout.getRegion("header")).toBeNull();
	});
});

// ── LayoutRegistry ──────────────────────────────────────────

describe("LayoutRegistry", () => {
	let registry: LayoutRegistry;

	beforeEach(() => {
		registry = new LayoutRegistry();
	});

	it("register and resolve returns layout instance", () => {
		registry.register("single", () => new SinglePaneLayout());
		const layout = registry.resolve("single");
		expect(layout).not.toBeNull();
		expect(layout!.type).toBe("single");
	});

	it("resolve returns null for unknown type", () => {
		expect(registry.resolve("missing")).toBeNull();
	});

	it("has returns true for registered, false for unknown", () => {
		registry.register("split", () => new SplitLayout());
		expect(registry.has("split")).toBe(true);
		expect(registry.has("unknown")).toBe(false);
	});

	it("getRegisteredTypes returns all registered names", () => {
		registry.register("single", () => new SinglePaneLayout());
		registry.register("split", () => new SplitLayout());
		registry.register("tabbed", () => new TabbedLayout());
		expect(registry.getRegisteredTypes()).toEqual(["single", "split", "tabbed"]);
	});

	it("resolve passes config to factory", () => {
		registry.register("split", (config) => new SplitLayout(config as { ratio?: number }));
		const layout = registry.resolve("split", { ratio: 0.7 }) as SplitLayout;
		expect(layout).not.toBeNull();

		const container = makeContainer();
		layout.mount(container);
		const root = container.children[0] as HTMLElement;
		expect(root.style.getPropertyValue("--ft-split-ratio")).toBe("70%");
	});

	// ILayout contract compliance — verify all layouts satisfy the interface

	const layoutFactories: [string, () => ILayout][] = [
		["SinglePaneLayout", () => new SinglePaneLayout()],
		["SplitLayout", () => new SplitLayout()],
		["TabbedLayout", () => new TabbedLayout({ tabs: [{ id: "a", label: "A" }] })],
		["StackedLayout", () => new StackedLayout({ sections: [{ id: "s1" }] })],
	];

	it.each(layoutFactories)("%s implements mount/getRegion/dispose contract", (_name, factory) => {
		const layout = factory();

		// Has type
		expect(typeof layout.type).toBe("string");

		// mount works
		const container = makeContainer();
		layout.mount(container);
		expect(container.children.length).toBeGreaterThan(0);

		// dispose cleans up
		layout.dispose();
		expect(container.children.length).toBe(0);
	});

	it("re-mount after dispose works cleanly", () => {
		const layout = new SinglePaneLayout();
		const container = makeContainer();

		layout.mount(container);
		expect(container.children.length).toBe(1);

		layout.dispose();
		expect(container.children.length).toBe(0);

		layout.mount(container);
		expect(container.children.length).toBe(1);
		expect(layout.getRegion("content")).not.toBeNull();
	});
});
