import { describe, it, expect } from "vitest";
import {
	loadOrBuildCache,
	buildVaultContext,
	filterByScope,
	invalidateContextCache,
} from "../../../src/domain/vault-ops/vault-context.js";
import type {
	VaultOpsDeps,
	VaultContextCache,
} from "../../../src/domain/vault-ops/vault-ops-types.js";

// ── Test helper ─────────────────────────────────────────────────────

interface FileEntry {
	readonly content: string;
	readonly mtimeMs: number;
}

function makeDeps(files: Record<string, FileEntry> = {}): VaultOpsDeps {
	const store: Record<string, string> = {};
	const mtimes: Record<string, number> = {};

	for (const [path, entry] of Object.entries(files)) {
		store[path] = entry.content;
		mtimes[path] = entry.mtimeMs;
	}

	return {
		disk: {
			existsSync: (p: string) => p in store,
			readFileSync: (p: string, _enc?: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return store[p];
			},
			writeFileSync: (p: string, content: string) => {
				store[p] = content;
			},
			mkdirSync: () => undefined,
			renameSync: (from: string, to: string) => {
				if (!(from in store)) throw new Error(`ENOENT: ${from}`);
				store[to] = store[from];
				mtimes[to] = mtimes[from];
				delete store[from];
				delete mtimes[from];
			},
			readdirSync: (dir: string, _opts?: unknown) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				return Object.keys(store)
					.filter((p) => p.startsWith(prefix))
					.map((p) => ({
						name: p.slice(prefix.length),
						isFile: () => true,
						isDirectory: () => false,
					}));
			},
			statSync: (p: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return { mtimeMs: mtimes[p] ?? 0 };
			},
			rmSync: (p: string) => {
				delete store[p];
				delete mtimes[p];
			},
		},
		clock: { iso: () => "2026-03-21T10:00:00Z" },
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (from: string, to: string) =>
				to.startsWith(from + "/") ? to.slice(from.length + 1) : to,
		},
		vaultRoot: "/vault",
	};
}

function mdFile(tags: readonly string[], mtimeMs = 1000): FileEntry {
	if (tags.length === 0) {
		return { content: "# Note\n\nPlain content", mtimeMs };
	}
	const tagLines = tags.map((t) => `  - ${t}`).join("\n");
	return {
		content: `---\ntags:\n${tagLines}\n---\n# Note\n\nContent`,
		mtimeMs,
	};
}

// ── loadOrBuildCache — cold start ───────────────────────────────────

describe("loadOrBuildCache — cold start", () => {
	it("builds cache from vault files when no cache exists", () => {
		const deps = makeDeps({
			"/vault/notes/a.md": mdFile(["alpha"]),
			"/vault/notes/b.md": mdFile(["beta"]),
		});

		const cache = loadOrBuildCache(deps);

		expect(cache.version).toBe(1);
		expect(cache.builtAt).toBe("2026-03-21T10:00:00Z");
		expect(cache.fileIndex).toHaveLength(2);
	});

	it("writes cache to disk after cold start", () => {
		const deps = makeDeps({
			"/vault/notes/a.md": mdFile(["alpha"]),
		});

		loadOrBuildCache(deps);

		const written = deps.disk.readFileSync(
			"/vault/.flowti/var/vault-context-cache.json",
			"utf-8",
		);
		const parsed = JSON.parse(written) as VaultContextCache;
		expect(parsed.version).toBe(1);
		expect(parsed.fileIndex).toHaveLength(1);
	});

	it("counts notes per folder correctly", () => {
		const deps = makeDeps({
			"/vault/docs/a.md": mdFile([]),
			"/vault/docs/b.md": mdFile([]),
			"/vault/notes/c.md": mdFile([]),
		});

		const cache = loadOrBuildCache(deps);

		const docs = cache.folderMap.find((f) => f.path === "docs");
		const notes = cache.folderMap.find((f) => f.path === "notes");
		expect(docs?.noteCount).toBe(2);
		expect(notes?.noteCount).toBe(1);
	});

	it("aggregates tags correctly", () => {
		const deps = makeDeps({
			"/vault/a.md": mdFile(["alpha", "shared"]),
			"/vault/b.md": mdFile(["beta", "shared"]),
		});

		const cache = loadOrBuildCache(deps);

		const shared = cache.tagIndex.find((t) => t.tag === "shared");
		expect(shared?.count).toBe(2);

		// shared is most common, so it should come first
		expect(cache.tagIndex[0].tag).toBe("shared");
	});
});

// ── loadOrBuildCache — warm start ───────────────────────────────────

describe("loadOrBuildCache — warm start", () => {
	it("reuses cached entries for unchanged files (same mtime)", () => {
		const deps = makeDeps({
			"/vault/notes/a.md": mdFile(["alpha"], 1000),
			"/vault/notes/b.md": mdFile(["beta"], 2000),
		});

		const coldCache = loadOrBuildCache(deps);

		// Second call with same mtimes should reuse entries
		const warmCache = loadOrBuildCache(deps, coldCache);

		expect(warmCache.fileIndex).toHaveLength(2);
		// Entries should be identical object references (reused)
		const coldA = coldCache.fileIndex.find((e) => e.path === "notes/a.md");
		const warmA = warmCache.fileIndex.find((e) => e.path === "notes/a.md");
		expect(warmA).toBe(coldA);
	});

	it("detects new files and adds them to index", () => {
		const deps = makeDeps({
			"/vault/notes/a.md": mdFile(["alpha"], 1000),
		});

		const coldCache = loadOrBuildCache(deps);
		expect(coldCache.fileIndex).toHaveLength(1);

		// Add a new file to the store
		const newContent = mdFile(["gamma"], 3000);
		deps.disk.writeFileSync(
			"/vault/notes/c.md",
			newContent.content,
		);

		const warmCache = loadOrBuildCache(deps, coldCache);

		expect(warmCache.fileIndex).toHaveLength(2);
		const newEntry = warmCache.fileIndex.find((e) => e.path === "notes/c.md");
		expect(newEntry).toBeDefined();
	});

	it("removes deleted files from index", () => {
		const deps = makeDeps({
			"/vault/notes/a.md": mdFile(["alpha"], 1000),
			"/vault/notes/b.md": mdFile(["beta"], 2000),
		});

		const coldCache = loadOrBuildCache(deps);
		expect(coldCache.fileIndex).toHaveLength(2);

		// Remove a file from the store
		deps.disk.rmSync("/vault/notes/b.md");

		const warmCache = loadOrBuildCache(deps, coldCache);

		expect(warmCache.fileIndex).toHaveLength(1);
		expect(warmCache.fileIndex[0].path).toBe("notes/a.md");
	});
});

// ── buildVaultContext ───────────────────────────────────────────────

describe("buildVaultContext", () => {
	it("returns folderMap, tagIndex, and recentChanges", () => {
		const deps = makeDeps({
			"/vault/docs/a.md": mdFile(["alpha"], 1000),
			"/vault/notes/b.md": mdFile(["beta"], 2000),
		});

		const ctx = buildVaultContext(deps);

		expect(ctx.folderMap.length).toBeGreaterThan(0);
		expect(ctx.tagIndex.length).toBeGreaterThan(0);
		expect(ctx.recentChanges.length).toBeGreaterThan(0);
	});

	it("limits recentChanges to 50 entries", () => {
		const files: Record<string, FileEntry> = {};
		for (let i = 0; i < 60; i++) {
			files[`/vault/notes/note-${String(i).padStart(3, "0")}.md`] = mdFile(
				[],
				1000 + i,
			);
		}

		const deps = makeDeps(files);
		const ctx = buildVaultContext(deps);

		expect(ctx.recentChanges).toHaveLength(50);
	});
});

// ── filterByScope ───────────────────────────────────────────────────

describe("filterByScope", () => {
	it("filters folderMap to allowed folder prefixes", () => {
		const ctx = {
			folderMap: [
				{ path: "docs", noteCount: 3 },
				{ path: "notes", noteCount: 2 },
				{ path: "archive", noteCount: 5 },
			],
			tagIndex: [{ tag: "alpha", count: 1 }],
			recentChanges: [],
		};

		const filtered = filterByScope(ctx, { folders: ["docs"] });

		expect(filtered.folderMap).toHaveLength(1);
		expect(filtered.folderMap[0].path).toBe("docs");
	});

	it("filters tagIndex to allowed tag prefixes", () => {
		const ctx = {
			folderMap: [{ path: "docs", noteCount: 3 }],
			tagIndex: [
				{ tag: "project/cli", count: 5 },
				{ tag: "project/plugin", count: 3 },
				{ tag: "random", count: 1 },
			],
			recentChanges: [],
		};

		const filtered = filterByScope(ctx, { tags: ["project"] });

		expect(filtered.tagIndex).toHaveLength(2);
		expect(filtered.tagIndex.map((t) => t.tag)).toEqual([
			"project/cli",
			"project/plugin",
		]);
	});

	it("returns unfiltered when no scope provided", () => {
		const ctx = {
			folderMap: [
				{ path: "docs", noteCount: 3 },
				{ path: "notes", noteCount: 2 },
			],
			tagIndex: [{ tag: "alpha", count: 1 }],
			recentChanges: [],
		};

		const result = filterByScope(ctx);

		expect(result).toBe(ctx);
	});
});

// ── invalidateContextCache ──────────────────────────────────────────

describe("invalidateContextCache", () => {
	it("deletes the cache file", () => {
		const deps = makeDeps({
			"/vault/notes/a.md": mdFile(["alpha"]),
		});

		// Build cache first so file exists
		loadOrBuildCache(deps);
		expect(
			deps.disk.existsSync("/vault/.flowti/var/vault-context-cache.json"),
		).toBe(true);

		invalidateContextCache(deps);

		expect(
			deps.disk.existsSync("/vault/.flowti/var/vault-context-cache.json"),
		).toBe(false);
	});
});
