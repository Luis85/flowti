// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { SinglePaneLayout } from "../../../src/ui/layouts/SinglePaneLayout";
import { SplitLayout } from "../../../src/ui/layouts/SplitLayout";
import { TabbedLayout } from "../../../src/ui/layouts/TabbedLayout";
import { StackedLayout } from "../../../src/ui/layouts/StackedLayout";
import type { ILayout } from "../../../src/ui/layouts/types";

// ── Helpers ─────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	return document.createElement("div");
}

function injectContent(el: HTMLElement, text: string): HTMLElement {
	const child = document.createElement("div");
	child.textContent = text;
	el.appendChild(child);
	return child;
}

// ── Render with Content ─────────────────────────────────────

describe("Layout Integration: render with content", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = makeContainer();
	});

	it("SinglePaneLayout renders content in 'content' region", () => {
		const layout = new SinglePaneLayout();
		layout.mount(container);
		const region = layout.getRegion("content")!;
		injectContent(region.el, "Hello Single");
		expect(region.el.textContent).toBe("Hello Single");
		layout.dispose();
	});

	it("SplitLayout renders content in both regions", () => {
		const layout = new SplitLayout();
		layout.mount(container);
		injectContent(layout.getRegion("primary")!.el, "Primary Content");
		injectContent(layout.getRegion("inspector")!.el, "Inspector Content");
		expect(layout.getRegion("primary")!.el.textContent).toBe("Primary Content");
		expect(layout.getRegion("inspector")!.el.textContent).toBe("Inspector Content");
		layout.dispose();
	});

	it("TabbedLayout renders content per tab panel", () => {
		const layout = new TabbedLayout({ tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
		layout.mount(container);
		injectContent(layout.getTabPanel("a")!, "Tab A Content");
		injectContent(layout.getTabPanel("b")!, "Tab B Content");
		expect(layout.getTabPanel("a")!.textContent).toBe("Tab A Content");
		expect(layout.getTabPanel("b")!.textContent).toBe("Tab B Content");
		layout.dispose();
	});

	it("StackedLayout renders content in each section", () => {
		const layout = new StackedLayout({ sections: [{ id: "top" }, { id: "mid" }, { id: "bot" }] });
		layout.mount(container);
		injectContent(layout.getRegion("top")!.el, "Top");
		injectContent(layout.getRegion("mid")!.el, "Middle");
		injectContent(layout.getRegion("bot")!.el, "Bottom");
		expect(layout.getRegion("top")!.el.textContent).toBe("Top");
		expect(layout.getRegion("mid")!.el.textContent).toBe("Middle");
		expect(layout.getRegion("bot")!.el.textContent).toBe("Bottom");
		layout.dispose();
	});
});

// ── Layout Switching ────────────────────────────────────────

describe("Layout Integration: switching layouts on same container", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = makeContainer();
	});

	it("switching from single to split replaces DOM correctly", () => {
		const single = new SinglePaneLayout();
		single.mount(container);
		expect(container.children.length).toBe(1);
		expect((container.children[0] as HTMLElement).classList.contains("ft-layout-single")).toBe(true);

		single.dispose();
		expect(container.children.length).toBe(0);

		const split = new SplitLayout();
		split.mount(container);
		expect(container.children.length).toBe(1);
		expect((container.children[0] as HTMLElement).classList.contains("ft-layout-split")).toBe(true);
		split.dispose();
	});

	it("switching from tabbed to stacked replaces DOM correctly", () => {
		const tabbed = new TabbedLayout({ tabs: [{ id: "t1", label: "T1" }] });
		tabbed.mount(container);
		expect((container.children[0] as HTMLElement).classList.contains("ft-layout-tabbed")).toBe(true);

		tabbed.dispose();

		const stacked = new StackedLayout({ sections: [{ id: "s1" }] });
		stacked.mount(container);
		expect(container.children.length).toBe(1);
		expect((container.children[0] as HTMLElement).classList.contains("ft-layout-stacked")).toBe(true);
		stacked.dispose();
	});
});

// ── Disposal Verification ───────────────────────────────────

describe("Layout Integration: disposal cleans up all DOM children", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = makeContainer();
	});

	const layouts: [string, () => ILayout][] = [
		["SinglePaneLayout", () => new SinglePaneLayout()],
		["SplitLayout", () => new SplitLayout()],
		["TabbedLayout", () => new TabbedLayout({ tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] })],
		["StackedLayout", () => new StackedLayout({ sections: [{ id: "s1" }, { id: "s2" }] })],
	];

	it.each(layouts)("%s dispose leaves container empty", (_name, factory) => {
		const layout = factory();
		layout.mount(container);

		// Inject content into all regions
		const testRegions = ["content", "primary", "inspector", "tabs", "s1", "s2"];
		for (const name of testRegions) {
			const region = layout.getRegion(name);
			if (region) injectContent(region.el, `content-${name}`);
		}

		layout.dispose();
		expect(container.children.length).toBe(0);
	});
});

// ── Region Re-access ────────────────────────────────────────

describe("Layout Integration: region persistence", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = makeContainer();
	});

	it("getRegion returns same element on repeated calls", () => {
		const layout = new SplitLayout();
		layout.mount(container);
		const first = layout.getRegion("primary");
		const second = layout.getRegion("primary");
		expect(first).not.toBeNull();
		expect(first!.el).toBe(second!.el);
		layout.dispose();
	});

	it("content persists across getRegion re-calls", () => {
		const layout = new SinglePaneLayout();
		layout.mount(container);
		injectContent(layout.getRegion("content")!.el, "persistent data");
		const region = layout.getRegion("content")!;
		expect(region.el.textContent).toBe("persistent data");
		layout.dispose();
	});
});
