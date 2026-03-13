/**
 * sitemap-project.test.ts — Tests for project-level sitemap operations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	getSitemapPath,
	sitemapExists,
	isSitemapDirty,
	createProjectSitemap,
	importSitemap,
	regenerateFromSitemap,
} from "../../../src/domain/sitemap/sitemap-project.js";
import { computeHash } from "../../../src/infrastructure/sitemap-watcher.js";
import type { SitemapProjectDeps } from "../../../src/domain/sitemap/sitemap-project.js";

// ── In-memory filesystem stub ────────────────────────────────────────

function createMemoryDeps(): SitemapProjectDeps & { files: Map<string, string>; dirs: Set<string> } {
	const files = new Map<string, string>();
	const dirs = new Set<string>();

	return {
		files,
		dirs,
		disk: {
			existsSync(p: string) { return files.has(p) || dirs.has(p); },
			readFileSync(p: string, _enc: string) {
				const content = files.get(p);
				if (content === undefined) throw new Error(`ENOENT: ${p}`);
				return content;
			},
			writeFileSync(p: string, data: string, _enc: string) { files.set(p, data); },
			mkdirSync(p: string, _opts?: unknown) { dirs.add(p); },
			statSync(_p: string) { return { mtime: new Date() }; },
		} as SitemapProjectDeps["disk"],
		paths: {
			join(...parts: string[]) { return parts.join("/"); },
			dirname(p: string) { return p.split("/").slice(0, -1).join("/"); },
			basename(p: string) { return p.split("/").pop()!; },
			relative(_from: string, to: string) { return to; },
			sep: "/",
		} as SitemapProjectDeps["paths"],
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe("getSitemapPath", () => {
	it("joins project root with configs/sitemap.json", () => {
		const deps = createMemoryDeps();
		expect(getSitemapPath("/my/project", deps)).toBe("/my/project/configs/sitemap.json");
	});
});

describe("sitemapExists", () => {
	it("returns false when no sitemap file", () => {
		const deps = createMemoryDeps();
		expect(sitemapExists("/root", deps)).toBe(false);
	});

	it("returns true when sitemap file exists", () => {
		const deps = createMemoryDeps();
		deps.files.set("/root/configs/sitemap.json", "{}");
		expect(sitemapExists("/root", deps)).toBe(true);
	});
});

describe("isSitemapDirty", () => {
	it("returns false when sitemap does not exist", () => {
		const deps = createMemoryDeps();
		expect(isSitemapDirty("/root", deps)).toBe(false);
	});

	it("returns true when sitemap exists but no hash file", () => {
		const deps = createMemoryDeps();
		deps.files.set("/root/configs/sitemap.json", "{}");
		expect(isSitemapDirty("/root", deps)).toBe(true);
	});

	it("returns false when hash matches", () => {
		const deps = createMemoryDeps();
		const content = '{"version": 1}';
		deps.files.set("/root/configs/sitemap.json", content);
		deps.files.set("/root/configs/.sitemap-hash", computeHash(content));
		expect(isSitemapDirty("/root", deps)).toBe(false);
	});

	it("returns true when hash differs", () => {
		const deps = createMemoryDeps();
		deps.files.set("/root/configs/sitemap.json", '{"version": 1}');
		deps.files.set("/root/configs/.sitemap-hash", "stale-hash");
		expect(isSitemapDirty("/root", deps)).toBe(true);
	});
});

describe("createProjectSitemap", () => {
	it("creates a valid sitemap with at least one view", () => {
		const deps = createMemoryDeps();
		const result = createProjectSitemap("/root", "My App", deps);

		expect(result.created).toBe(true);
		expect(result.viewCount).toBeGreaterThanOrEqual(1);
		expect(result.path).toBe("/root/configs/sitemap.json");

		const json = JSON.parse(deps.files.get("/root/configs/sitemap.json")!);
		expect(json.version).toBe(1);
		expect(Object.keys(json.views).length).toBeGreaterThanOrEqual(1);
	});

	it("includes route and parent properties in barebones views", () => {
		const deps = createMemoryDeps();
		createProjectSitemap("/root", "My App", deps);

		const json = JSON.parse(deps.files.get("/root/configs/sitemap.json")!);
		const viewIds = Object.keys(json.views);
		const views = Object.values(json.views) as Record<string, unknown>[];

		// At least one view should have a route
		const withRoute = views.filter((v) => v.route !== undefined);
		expect(withRoute.length).toBeGreaterThanOrEqual(1);

		// Non-root views should declare a parent
		const withParent = views.filter((v) => v.parent !== undefined);
		if (viewIds.length > 1) {
			expect(withParent.length).toBeGreaterThanOrEqual(1);
		}
	});

	it("does not overwrite existing sitemap", () => {
		const deps = createMemoryDeps();
		deps.files.set("/root/configs/sitemap.json", '{"existing": true}');

		const result = createProjectSitemap("/root", "My App", deps);
		expect(result.created).toBe(false);
		expect(result.viewCount).toBe(0);
		expect(deps.files.get("/root/configs/sitemap.json")).toBe('{"existing": true}');
	});

	it("creates configs directory if missing", () => {
		const deps = createMemoryDeps();
		createProjectSitemap("/root", "Test", deps);
		expect(deps.dirs.has("/root/configs")).toBe(true);
	});
});

describe("importSitemap", () => {
	let deps: ReturnType<typeof createMemoryDeps>;

	beforeEach(() => {
		deps = createMemoryDeps();
	});

	it("returns error when sitemap does not exist", () => {
		const result = importSitemap("/root", deps);
		expect(result.imported).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("not found");
	});

	it("returns error for invalid JSON", () => {
		deps.files.set("/root/configs/sitemap.json", "not-json");
		const result = importSitemap("/root", deps);
		expect(result.imported).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("Invalid JSON");
	});

	it("imports all views as component instances", () => {
		const sitemap = {
			version: 1,
			views: {
				home: { title: "Home", icon: "home", domain: "nav", status: "draft", items: [] },
				detail: { type: "dynamic", title: "Detail", handler: "detail", capabilities: ["View"] },
			},
		};
		deps.files.set("/root/configs/sitemap.json", JSON.stringify(sitemap));

		const result = importSitemap("/root", deps);
		expect(result.imported).toBe(2);
		expect(result.skipped).toBe(0);
		expect(result.errors).toHaveLength(0);

		// Verify component JSON was written
		const homeJson = JSON.parse(deps.files.get("/root/components/home/home.json")!);
		expect(homeJson.name).toBe("Home");
		expect(homeJson.id).toBe("home");
		expect(homeJson.type).toBe("page");
		expect(homeJson.domain).toBe("nav");
	});

	it("skips existing components without overwrite", () => {
		const sitemap = {
			version: 1,
			views: { home: { title: "Home", items: [] } },
		};
		deps.files.set("/root/configs/sitemap.json", JSON.stringify(sitemap));
		deps.files.set("/root/components/home/home.json", '{"existing": true}');

		const result = importSitemap("/root", deps);
		expect(result.imported).toBe(0);
		expect(result.skipped).toBe(1);
		// Original file preserved
		expect(deps.files.get("/root/components/home/home.json")).toBe('{"existing": true}');
	});

	it("stores hash after import", () => {
		const content = JSON.stringify({ version: 1, views: { a: { title: "A", items: [] } } });
		deps.files.set("/root/configs/sitemap.json", content);

		importSitemap("/root", deps);

		const storedHash = deps.files.get("/root/configs/.sitemap-hash");
		expect(storedHash).toBe(computeHash(content));
	});
});

describe("regenerateFromSitemap", () => {
	it("overwrites existing component instances", () => {
		const deps = createMemoryDeps();
		const sitemap = {
			version: 1,
			views: { home: { title: "Updated Home", icon: "star", items: [] } },
		};
		deps.files.set("/root/configs/sitemap.json", JSON.stringify(sitemap));
		deps.files.set("/root/components/home/home.json", '{"name": "Old"}');

		const result = regenerateFromSitemap("/root", deps);
		expect(result.imported).toBe(1);
		expect(result.skipped).toBe(0);

		const updated = JSON.parse(deps.files.get("/root/components/home/home.json")!);
		expect(updated.name).toBe("Updated Home");
		expect(updated.icon).toBe("star");
	});
});
