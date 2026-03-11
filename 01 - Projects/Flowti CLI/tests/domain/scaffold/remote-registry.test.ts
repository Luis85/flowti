import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import {
	fetchRegistryIndex,
	fetchRegistryEntry,
	searchEntries,
	filterByType,
	loadCachedIndex,
	saveCachedIndex,
	cachePath,
	installScaffoldDefinition,
	installPlugin,
	installAiTool,
	installFromRegistry,
	parseRegistryConfigs,
	validateRegistryUrl,
	type RegistryIndex,
	type RegistryEntry,
	type HttpFetcher,
} from "../../../src/domain/scaffold/remote-registry.js";
import { createMockFs } from "../../mocks/mock-fs.js";

const testPaths = {
	join: (...args: string[]) => args.join("/"),
	basename: (p: string, ext?: string) => { const b = path.basename(p); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	resolve: (...args: string[]) => args.join("/"),
	relative: (_from: string, to: string) => to,
};

const testDeps = { paths: testPaths } as const;

// ── Helpers ──────────────────────────────────────────────────────────

function makeIndex(entries: RegistryEntry[] = []): RegistryIndex {
	return { version: 1, name: "test-registry", description: "Test", updated: "2026-01-01", entries };
}

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
	return {
		id: "test-def",
		type: "scaffold",
		name: "Test Definition",
		description: "A test scaffold",
		version: "1.0.0",
		url: "https://example.com/test-def.json",
		...overrides,
	};
}

function mockFetch(responses: Record<string, string>): HttpFetcher {
	return async (url: string) => responses[url] ?? null;
}

// ── fetchRegistryIndex ───────────────────────────────────────────────

describe("fetchRegistryIndex", () => {
	it("fetches and parses a valid index", async () => {
		const index = makeIndex([makeEntry()]);
		const fetch = mockFetch({ "https://reg.example.com/index.json": JSON.stringify(index) });
		const result = await fetchRegistryIndex("https://reg.example.com", fetch);
		expect(result.ok).toBe(true);
		expect(result.data?.name).toBe("test-registry");
		expect(result.data?.entries).toHaveLength(1);
	});

	it("appends index.json to URL with trailing slash", async () => {
		const index = makeIndex();
		const fetch = mockFetch({ "https://reg.example.com/index.json": JSON.stringify(index) });
		const result = await fetchRegistryIndex("https://reg.example.com/", fetch);
		expect(result.ok).toBe(true);
	});

	it("returns error when fetch fails", async () => {
		const fetch = mockFetch({});
		const result = await fetchRegistryIndex("https://bad.example.com", fetch);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Failed to fetch");
	});

	it("returns error for invalid JSON", async () => {
		const fetch = mockFetch({ "https://reg.example.com/index.json": "not json" });
		const result = await fetchRegistryIndex("https://reg.example.com", fetch);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("parse");
	});

	it("returns error for unsupported version", async () => {
		const fetch = mockFetch({ "https://reg.example.com/index.json": '{"version": 99}' });
		const result = await fetchRegistryIndex("https://reg.example.com", fetch);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("version");
	});
});

// ── fetchRegistryEntry ───────────────────────────────────────────────

describe("fetchRegistryEntry", () => {
	it("fetches and parses entry data", async () => {
		const entry = makeEntry({ url: "https://example.com/def.json" });
		const fetch = mockFetch({ "https://example.com/def.json": '{"id": "test"}' });
		const result = await fetchRegistryEntry(entry, fetch);
		expect(result.ok).toBe(true);
		expect((result.data as Record<string, unknown>).id).toBe("test");
	});

	it("returns error when fetch fails", async () => {
		const entry = makeEntry({ url: "https://example.com/missing.json" });
		const result = await fetchRegistryEntry(entry, mockFetch({}));
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Failed to fetch");
	});

	it("returns error for invalid JSON", async () => {
		const entry = makeEntry({ url: "https://example.com/bad.json" });
		const fetch = mockFetch({ "https://example.com/bad.json": "{invalid" });
		const result = await fetchRegistryEntry(entry, fetch);
		expect(result.ok).toBe(false);
	});
});

// ── searchEntries ────────────────────────────────────────────────────

describe("searchEntries", () => {
	const entries = [
		makeEntry({ id: "react-app", name: "React App", type: "scaffold" }),
		makeEntry({ id: "eslint-config", name: "ESLint Config", type: "plugin", description: "Linting rules" }),
		makeEntry({ id: "code-review", name: "Code Review", type: "ai-tool" }),
	];

	it("searches by name (case insensitive)", () => {
		expect(searchEntries(entries, "react")).toHaveLength(1);
		expect(searchEntries(entries, "REACT")).toHaveLength(1);
	});

	it("searches by description", () => {
		expect(searchEntries(entries, "linting")).toHaveLength(1);
	});

	it("searches by id", () => {
		expect(searchEntries(entries, "eslint-config")).toHaveLength(1);
	});

	it("filters by type", () => {
		expect(searchEntries(entries, "", "scaffold")).toHaveLength(1);
		expect(searchEntries(entries, "", "plugin")).toHaveLength(1);
	});

	it("returns all for empty query", () => {
		expect(searchEntries(entries, "")).toHaveLength(3);
	});
});

// ── filterByType ─────────────────────────────────────────────────────

describe("filterByType", () => {
	it("filters entries by type", () => {
		const entries = [
			makeEntry({ type: "scaffold" }),
			makeEntry({ type: "plugin" }),
			makeEntry({ type: "ai-tool" }),
		];
		expect(filterByType(entries, "plugin")).toHaveLength(1);
	});
});

// ── Cache ────────────────────────────────────────────────────────────

describe("cache", () => {
	it("returns null when no cached index", () => {
		const fs = createMockFs();
		expect(loadCachedIndex(testDeps, "/vault", "test-reg", fs)).toBeNull();
	});

	it("saves and loads cached index", () => {
		const fs = createMockFs();
		const index = makeIndex([makeEntry()]);
		saveCachedIndex(testDeps, "/vault", "test-reg", index, fs);
		const loaded = loadCachedIndex(testDeps, "/vault", "test-reg", fs);
		expect(loaded?.name).toBe("test-registry");
		expect(loaded?.entries).toHaveLength(1);
	});

	it("cachePath is under .flowti/cache", () => {
		expect(cachePath(testDeps, "/vault")).toContain(".flowti");
		expect(cachePath(testDeps, "/vault")).toContain("cache");
	});
});

// ── installScaffoldDefinition ────────────────────────────────────────

describe("installScaffoldDefinition", () => {
	it("installs a valid definition", () => {
		const fs = createMockFs();
		const result = installScaffoldDefinition(testDeps, { id: "my-def", label: "My Def" }, "/project", fs);
		expect(result.ok).toBe(true);
	});

	it("rejects invalid definition", () => {
		const fs = createMockFs();
		expect(installScaffoldDefinition(testDeps, null, "/project", fs).ok).toBe(false);
	});

	it("rejects definition without id", () => {
		const fs = createMockFs();
		expect(installScaffoldDefinition(testDeps, { label: "No ID" }, "/project", fs).ok).toBe(false);
	});

	it("skips existing definition", () => {
		const fs = createMockFs({ "/project/configs/definitions/my-def.json": "{}" });
		const result = installScaffoldDefinition(testDeps, { id: "my-def" }, "/project", fs);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("already exists");
	});
});

// ── installPlugin ────────────────────────────────────────────────────

describe("installPlugin", () => {
	it("installs a valid plugin", () => {
		const fs = createMockFs();
		const result = installPlugin(testDeps, { name: "my-plugin", description: "Test", commands: {} }, "/vault", fs);
		expect(result.ok).toBe(true);
	});

	it("rejects plugin without name", () => {
		const fs = createMockFs();
		expect(installPlugin(testDeps, { description: "No name" }, "/vault", fs).ok).toBe(false);
	});

	it("skips existing plugin", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/my-plugin/manifest.json": "{}" });
		const result = installPlugin(testDeps, { name: "my-plugin" }, "/vault", fs);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("already exists");
	});
});

// ── installAiTool ────────────────────────────────────────────────────

describe("installAiTool", () => {
	it("installs a valid AI tool", () => {
		const fs = createMockFs();
		const result = installAiTool(testDeps, { name: "my-tool", description: "Test" }, "/vault", fs);
		expect(result.ok).toBe(true);
	});

	it("rejects tool without name", () => {
		const fs = createMockFs();
		expect(installAiTool(testDeps, { description: "No name" }, "/vault", fs).ok).toBe(false);
	});

	it("skips existing tool", () => {
		const fs = createMockFs({ "/vault/.flowti/ai-tools/my-tool.json": "{}" });
		const result = installAiTool(testDeps, { name: "my-tool" }, "/vault", fs);
		expect(result.ok).toBe(false);
	});
});

// ── installFromRegistry ──────────────────────────────────────────────

describe("installFromRegistry", () => {
	it("installs multiple entries", async () => {
		const entries = [
			makeEntry({ id: "def-1", type: "scaffold", url: "https://ex.com/def1.json" }),
			makeEntry({ id: "plug-1", type: "plugin", url: "https://ex.com/plug1.json" }),
		];
		const fetch = mockFetch({
			"https://ex.com/def1.json": '{"id": "def-1", "label": "Def 1"}',
			"https://ex.com/plug1.json": '{"name": "plug-1", "description": "Plugin", "commands": {}}',
		});
		const fs = createMockFs();
		const result = await installFromRegistry(testDeps, entries, "/vault", "/project", fs, fetch);
		expect(result.installed).toEqual(["def-1", "plug-1"]);
		expect(result.errors).toEqual([]);
	});

	it("skips scaffolds when no project root", async () => {
		const entries = [makeEntry({ type: "scaffold", url: "https://ex.com/def.json" })];
		const fetch = mockFetch({ "https://ex.com/def.json": '{"id": "test"}' });
		const fs = createMockFs();
		const result = await installFromRegistry(testDeps, entries, "/vault", undefined, fs, fetch);
		expect(result.skipped).toHaveLength(1);
	});

	it("reports fetch errors", async () => {
		const entries = [makeEntry({ url: "https://ex.com/missing.json" })];
		const fs = createMockFs();
		const result = await installFromRegistry(testDeps, entries, "/vault", "/project", fs, mockFetch({}));
		expect(result.errors).toHaveLength(1);
	});

	it("skips already existing items", async () => {
		const entries = [makeEntry({ id: "def-1", type: "scaffold", url: "https://ex.com/def1.json" })];
		const fetch = mockFetch({ "https://ex.com/def1.json": '{"id": "def-1"}' });
		const fs = createMockFs({ "/project/configs/definitions/def-1.json": "{}" });
		const result = await installFromRegistry(testDeps, entries, "/vault", "/project", fs, fetch);
		expect(result.skipped).toHaveLength(1);
	});
});

// ── parseRegistryConfigs ─────────────────────────────────────────────

describe("parseRegistryConfigs", () => {
	it("parses valid configs", () => {
		const configs = [
			{ name: "reg1", url: "https://example.com" },
			{ name: "reg2", url: "https://other.com" },
		];
		expect(parseRegistryConfigs(configs)).toHaveLength(2);
	});

	it("returns empty for non-array", () => {
		expect(parseRegistryConfigs("not array")).toEqual([]);
		expect(parseRegistryConfigs(null)).toEqual([]);
	});

	it("filters out invalid entries", () => {
		const configs = [
			{ name: "valid", url: "https://ok.com" },
			{ name: 42, url: "bad" },
			null,
		];
		expect(parseRegistryConfigs(configs)).toHaveLength(1);
	});
});

// ── validateRegistryUrl ──────────────────────────────────────────────

describe("validateRegistryUrl", () => {
	it("accepts https URLs", () => {
		expect(validateRegistryUrl("https://example.com/registry")).toBe(true);
	});

	it("accepts http URLs", () => {
		expect(validateRegistryUrl("http://localhost:3000")).toBe(true);
	});

	it("rejects non-http URLs", () => {
		expect(validateRegistryUrl("ftp://example.com")).toBe(false);
	});

	it("rejects invalid URLs", () => {
		expect(validateRegistryUrl("not a url")).toBe(false);
	});
});
