import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	const documents: Map<string, { fm: Record<string, unknown>; body: string[] }> = new Map();

	return {
		Document: {
			create: (name: string) => {
				const state = { fm: {} as Record<string, unknown>, body: [] as string[] };
				const doc = {
					setFrontmatter: (k: string, v: unknown) => { state.fm[k] = v; return doc; },
					setRawFrontmatter: (k: string, v: string) => { state.fm[k] = v; return doc; },
					mergeFrontmatter: (obj: Record<string, unknown>) => { Object.assign(state.fm, obj); return doc; },
					addBlank: () => doc,
					heading: (_l: number, t: string) => { state.body.push(t); return doc; },
					text: (t: string) => { state.body.push(t); return doc; },
					table: () => doc,
					list: (items: string[]) => { state.body.push(...items); return doc; },
					save: (path: string) => { documents.set(path, state); },
				};
				state.fm._name = name;
				return doc;
			},
			wikilink: (target: string) => `[[${target}]]`,
		},
		_getDocuments: () => documents,
		_clearDocuments: () => documents.clear(),
	};
});

import { exportSitemapToMarkdown } from "../../../src/domain/sitemap/sitemap-export.js";
import type { Sitemap, PageObject } from "../../../src/infrastructure/sitemap-types.js";

const { _getDocuments, _clearDocuments } = await import("../../../src/infrastructure/document.js") as {
	_getDocuments: () => Map<string, { fm: Record<string, unknown>; body: string[] }>;
	_clearDocuments: () => void;
};

const mockDisk = {
	existsSync: vi.fn(() => true),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
	dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
};

const deps = { disk: mockDisk as never, paths: mockPaths as never };

beforeEach(() => {
	vi.clearAllMocks();
	_clearDocuments();
});

function createTestSitemap(pages: Record<string, PageObject>): Sitemap {
	return { version: 2, pages } as Sitemap;
}

function page(label: string, overrides: Partial<PageObject> = {}): PageObject {
	return { kind: "page", label, description: "", actions: [], ...overrides } as PageObject;
}

describe("exportSitemapToMarkdown", () => {
	it("exports all pages to markdown files", () => {
		const sitemap = createTestSitemap({
			start: page("Start"),
			dashboard: page("Dashboard", { parent: "start" }),
		});

		const result = exportSitemapToMarkdown(sitemap, "/out", deps);

		expect(result.exported).toBe(2);
		const docs = _getDocuments();
		expect(docs.has("/out/start.md")).toBe(true);
		expect(docs.has("/out/dashboard.md")).toBe(true);
	});

	it("sets up parent wikilink", () => {
		const sitemap = createTestSitemap({
			parent: page("Parent"),
			child: page("Child", { parent: "parent" }),
		});

		exportSitemapToMarkdown(sitemap, "/out", deps);

		const childDoc = _getDocuments().get("/out/child.md");
		expect(childDoc?.fm.up).toBe('"[[parent]]"');
	});

	it("sets up children wikilinks", () => {
		const sitemap = createTestSitemap({
			root: page("Root"),
			a: page("A", { parent: "root" }),
			b: page("B", { parent: "root" }),
		});

		exportSitemapToMarkdown(sitemap, "/out", deps);

		const rootDoc = _getDocuments().get("/out/root.md");
		expect(rootDoc?.fm.down).toBe('"[[a]], [[b]]"');
	});

	it("creates output directory", () => {
		const sitemap = createTestSitemap({ v: page("V") });

		exportSitemapToMarkdown(sitemap, "/out/sitemap", deps);

		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/out/sitemap", { recursive: true });
	});

	it("returns zero for empty sitemap", () => {
		const sitemap = createTestSitemap({});

		const result = exportSitemapToMarkdown(sitemap, "/out", deps);

		expect(result.exported).toBe(0);
	});

	it("includes page metadata in frontmatter", () => {
		const sitemap = createTestSitemap({
			view: page("My View", {
				icon: "star",
				domain: "navigation",
				status: "active",
			}),
		});

		exportSitemapToMarkdown(sitemap, "/out", deps);

		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.fm.icon).toBe("star");
		expect(doc?.fm.domain).toBe("navigation");
		expect(doc?.fm.status).toBe("active");
	});

	it("includes actions with different types in export", () => {
		const sitemap = createTestSitemap({
			view: page("Menu", {
				actions: [
					{ name: "onNav", label: "Navigate", type: "navigate", target: "other", key: "1" },
					{ name: "onHandle", label: "Handle", type: "handler", target: "my:action", key: "2" },
					{ name: "onBack", label: "Signal", type: "signal", target: "back", key: "3" },
					{ name: "onCmd", label: "Command", type: "command", target: "echo hi", key: "4" },
				],
			}),
			other: page("Other"),
		});
		const result = exportSitemapToMarkdown(sitemap, "/out", deps);
		expect(result.exported).toBe(2);
		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.body).toContain("Actions");
	});

	it("includes description when present", () => {
		const sitemap = createTestSitemap({
			view: page("V", { description: "A helpful view" }),
		});
		exportSitemapToMarkdown(sitemap, "/out", deps);
		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.body).toContain("A helpful view");
	});
});
