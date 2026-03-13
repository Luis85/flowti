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
import type { Sitemap } from "../../../src/infrastructure/sitemap-types.js";

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

function createTestSitemap(views: Record<string, unknown>): Sitemap {
	return { version: 1, views } as Sitemap;
}

describe("exportSitemapToMarkdown", () => {
	it("exports all views to markdown files", () => {
		const sitemap = createTestSitemap({
			start: { title: "Start", items: [] },
			dashboard: { title: "Dashboard", parent: "start", items: [] },
		});

		const result = exportSitemapToMarkdown(sitemap, "/out", deps);

		expect(result.exported).toBe(2);
		const docs = _getDocuments();
		expect(docs.has("/out/start.md")).toBe(true);
		expect(docs.has("/out/dashboard.md")).toBe(true);
	});

	it("sets up parent wikilink", () => {
		const sitemap = createTestSitemap({
			parent: { title: "Parent", items: [] },
			child: { title: "Child", parent: "parent", items: [] },
		});

		exportSitemapToMarkdown(sitemap, "/out", deps);

		const childDoc = _getDocuments().get("/out/child.md");
		expect(childDoc?.fm.up).toBe('"[[parent]]"');
	});

	it("sets up children wikilinks", () => {
		const sitemap = createTestSitemap({
			root: { title: "Root", items: [] },
			a: { title: "A", parent: "root", items: [] },
			b: { title: "B", parent: "root", items: [] },
		});

		exportSitemapToMarkdown(sitemap, "/out", deps);

		const rootDoc = _getDocuments().get("/out/root.md");
		expect(rootDoc?.fm.down).toBe('"[[a]], [[b]]"');
	});

	it("creates output directory", () => {
		const sitemap = createTestSitemap({ v: { title: "V", items: [] } });

		exportSitemapToMarkdown(sitemap, "/out/sitemap", deps);

		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/out/sitemap", { recursive: true });
	});

	it("returns zero for empty sitemap", () => {
		const sitemap = createTestSitemap({});

		const result = exportSitemapToMarkdown(sitemap, "/out", deps);

		expect(result.exported).toBe(0);
	});

	it("includes view metadata in frontmatter", () => {
		const sitemap = createTestSitemap({
			view: {
				title: "My View",
				icon: "star",
				domain: "navigation",
				status: "active",
				items: [],
			},
		});

		exportSitemapToMarkdown(sitemap, "/out", deps);

		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.fm.icon).toBe("star");
		expect(doc?.fm.domain).toBe("navigation");
		expect(doc?.fm.status).toBe("active");
	});

	it("includes items with different action types in export", () => {
		const sitemap = createTestSitemap({
			view: {
				title: "Menu",
				items: [
					{ type: "item", key: "1", label: "Navigate", navigate: "other" },
					{ type: "item", key: "2", label: "Handle", handler: "my:action" },
					{ type: "item", key: "3", label: "Signal", signal: "back" },
					{ type: "item", key: "4", label: "Command", command: "echo hi" },
					{ type: "separator" },
				],
			},
			other: { title: "Other", items: [] },
		});
		const result = exportSitemapToMarkdown(sitemap, "/out", deps);
		expect(result.exported).toBe(2);
		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.body).toContain("Items");
	});

	it("marks dynamic views in frontmatter", () => {
		const sitemap = createTestSitemap({
			dyn: { title: "Dynamic", type: "dynamic", handler: "dyn-handler", items: [] },
		});
		exportSitemapToMarkdown(sitemap, "/out", deps);
		const doc = _getDocuments().get("/out/dyn.md");
		expect(doc?.fm.type).toBe("dynamic");
	});

	it("includes capabilities section when present", () => {
		const sitemap = createTestSitemap({
			view: { title: "V", capabilities: ["read", "write"], items: [] },
		});
		exportSitemapToMarkdown(sitemap, "/out", deps);
		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.body).toContain("Capabilities");
		expect(doc?.body).toContain("read");
		expect(doc?.body).toContain("write");
	});

	it("includes description when present", () => {
		const sitemap = createTestSitemap({
			view: { title: "V", description: "A helpful view", items: [] },
		});
		exportSitemapToMarkdown(sitemap, "/out", deps);
		const doc = _getDocuments().get("/out/view.md");
		expect(doc?.body).toContain("A helpful view");
	});
});
