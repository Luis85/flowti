import { describe, it, expect } from "vitest";
import { parseCanvasToSitemap } from "../../../src/domain/make/canvas-sitemap-import.js";
import type { CanvasData } from "../../../src/domain/make/canvas-sitemap-types.js";

const group = (id: string, label: string, x: number, y: number, w: number, h: number): CanvasData["nodes"][number] =>
	({ id, type: "group", label, x, y, width: w, height: h });

const text = (id: string, t: string, x: number, y: number, opts: Record<string, string> = {}): CanvasData["nodes"][number] =>
	({ id, type: "text", text: t, x, y, width: 200, height: 100, ...opts });

const edge = (from: string, to: string): CanvasData["edges"][number] =>
	({ id: `${from}-${to}`, fromNode: from, toNode: to });

describe("parseCanvasToSitemap", () => {
	it("converts a text node to a component page (default kind)", () => {
		const canvas: CanvasData = { nodes: [text("n1", "Header")], edges: [] };
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.version).toBe(2);
		expect(sitemap.pages["header"]).toBeDefined();
		expect(sitemap.pages["header"].kind).toBe("component");
		expect(sitemap.pages["header"].label).toBe("Header");
	});

	it("maps color to page kind", () => {
		const canvas: CanvasData = {
			nodes: [
				text("n1", "Login", 0, 0, { color: "1" }),
				text("n2", "Settings Form", 0, 100, { color: "2" }),
				text("n3", "Items", 0, 200, { color: "3" }),
				text("n4", "Dashboard", 0, 300, { color: "4" }),
				text("n5", "Main Layout", 0, 400, { color: "5" }),
				text("n6", "Auth Service", 0, 500, { color: "6" }),
			],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["login"].kind).toBe("dialog");
		expect(sitemap.pages["settings-form"].kind).toBe("form");
		expect(sitemap.pages["items"].kind).toBe("list");
		expect(sitemap.pages["dashboard"].kind).toBe("page");
		expect(sitemap.pages["main-layout"].kind).toBe("layout");
		expect(sitemap.pages["auth-service"].kind).toBe("system");
	});

	it("maps shape to page kind (overrides color)", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "Decision", 0, 0, { shape: "diamond" })],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["decision"].kind).toBe("ui-component");
	});

	it("converts group nodes to container pages", () => {
		const canvas: CanvasData = {
			nodes: [group("g1", "Navigation", 0, 0, 600, 400)],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["navigation"].kind).toBe("container");
	});

	it("assigns parent when text node is inside a group", () => {
		const canvas: CanvasData = {
			nodes: [
				group("g1", "Navigation", 0, 0, 600, 400),
				text("n1", "Home", 50, 50),
			],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["home"].parent).toBe("navigation");
	});

	it("creates navigate actions from edges", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "Home", 0, 0), text("n2", "Dashboard", 300, 0)],
			edges: [edge("n1", "n2")],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		const homeActions = sitemap.pages["home"].actions;
		expect(homeActions).toHaveLength(1);
		expect(homeActions[0].type).toBe("navigate");
		expect(homeActions[0].target).toBe("dashboard");
	});

	it("performs additive merge — preserves existing actions", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "Home", 0, 0), text("n2", "New Page", 300, 0)],
			edges: [],
		};
		const existing = {
			version: 2 as const,
			pages: {
				"home": {
					kind: "page" as const,
					label: "Old Home",
					description: "existing",
					actions: [{ name: "onFoo", label: "Foo", type: "handler" as const, target: "foo:bar" }],
					dataSources: [{ id: "my-source" }],
				},
			},
		};
		const { sitemap, added, updated } = parseCanvasToSitemap(canvas, existing);
		expect(sitemap.pages["home"].label).toBe("Home");
		expect(sitemap.pages["home"].kind).toBe("component");
		expect(sitemap.pages["home"].actions).toHaveLength(1);
		expect(sitemap.pages["home"].actions[0].target).toBe("foo:bar");
		expect((sitemap.pages["home"] as Record<string, unknown>).dataSources).toBeDefined();
		expect(sitemap.pages["new-page"]).toBeDefined();
		expect(added).toBe(1);
		expect(updated).toBe(1);
	});

	it("merge preserves pages removed from canvas", () => {
		const canvas: CanvasData = { nodes: [text("n1", "Home", 0, 0)], edges: [] };
		const existing = {
			version: 2 as const,
			pages: {
				"home": { kind: "page" as const, label: "Home", description: "", actions: [] },
				"old-page": { kind: "page" as const, label: "Old", description: "", actions: [] },
			},
		};
		const { sitemap } = parseCanvasToSitemap(canvas, existing);
		expect(sitemap.pages["old-page"]).toBeDefined();
	});

	it("returns correct stats for fresh import", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "A", 0, 0), text("n2", "B", 300, 0)],
			edges: [],
		};
		const { added, updated, totalPages } = parseCanvasToSitemap(canvas);
		expect(added).toBe(2);
		expect(updated).toBe(0);
		expect(totalPages).toBe(2);
	});
});
