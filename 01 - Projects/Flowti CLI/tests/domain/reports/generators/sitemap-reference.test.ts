import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../../mocks/mock-fs.js";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));

vi.mock("../../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return { paths: { join: path.default.join, resolve: path.default.resolve, dirname: path.default.dirname, basename: path.default.basename, sep: "/" } };
});

vi.mock("../../../../src/infrastructure/config.js", () => ({ CLI_PROJECT: "/mock/cli-project" }));
vi.mock("../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-13T00:00:00Z", safeIso: () => "2026-03-13T00-00-00Z" },
}));

vi.mock("../../../../src/infrastructure/sitemap-loader.js", () => ({
	loadSitemap: vi.fn(() => ({ ok: false, errors: ["not found"] })),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { loadSitemap } from "../../../../src/infrastructure/sitemap-loader.js";
import { generateSitemapReference } from "../../../../src/domain/reports/generators/sitemap-reference.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

const MOCK_SITEMAP = {
	version: 2 as const,
	pages: {
		start: {
			kind: "page" as const,
			label: "Start",
			description: "Landing page",
			actions: [
				{ name: "onOpenProject", label: "Open Project", type: "navigate" as const, target: "project-list", key: "o" },
				{ name: "onQuit", label: "Quit", type: "signal" as const, target: "quit", key: "q" },
			],
		},
		"project-list": {
			kind: "page" as const,
			label: "Projects",
			description: "Project listing",
			actions: [
				{ name: "onBack", label: "Back", type: "signal" as const, target: "back", key: "b" },
			],
		},
	},
};

describe("generateSitemapReference", () => {
	it("returns failure when sitemap cannot load", () => {
		setDisk(createMockFs());
		const result = generateSitemapReference("/mock/project", mockDeps);
		expect(result.success).toBe(false);
	});

	it("generates successfully with valid sitemap", () => {
		setDisk(createMockFs());
		vi.mocked(loadSitemap).mockReturnValue({ ok: true, sitemap: MOCK_SITEMAP, errors: [], warnings: [] } as never);

		const result = generateSitemapReference("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.pages).toBe(2);
		expect(result.metrics.actions).toBe(3);
	});

	it("includes page index table", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(loadSitemap).mockReturnValue({ ok: true, sitemap: MOCK_SITEMAP, errors: [], warnings: [] } as never);

		generateSitemapReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Pages");
		expect(content).toContain("start");
		expect(content).toContain("project-list");
	});

	it("includes navigation graph", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(loadSitemap).mockReturnValue({ ok: true, sitemap: MOCK_SITEMAP, errors: [], warnings: [] } as never);

		generateSitemapReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Navigation Graph");
		expect(content).toContain("project-list");
	});

	it("writes frontmatter with type and pages count", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(loadSitemap).mockReturnValue({ ok: true, sitemap: MOCK_SITEMAP, errors: [], warnings: [] } as never);

		generateSitemapReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: SitemapReference");
		expect(content).toContain("pages: 2");
	});
});
