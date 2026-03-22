/**
 * vault-context.ts — Cached vault context builder with scope filtering.
 *
 * Builds an indexed view of the vault (folders, tags, recent changes)
 * with mtime-based cache invalidation. On warm starts only changed
 * files are re-parsed, making repeated builds fast on large vaults.
 */

import { parseFrontmatter } from "./frontmatter.js";
import type {
	VaultOpsDeps,
	VaultContext,
	VaultContextCache,
	VaultScope,
	FolderEntry,
	TagEntry,
	FileIndexEntry,
	RecentChange,
} from "./vault-ops-types.js";

// ── Constants ────────────────────────────────────────────────────────

const CACHE_VERSION = 1;
const MAX_RECENT = 50;

// ── Internal helpers ─────────────────────────────────────────────────

function cachePath(deps: VaultOpsDeps): string {
	return deps.paths.join(deps.vaultRoot, ".flowti/var/vault-context-cache.json");
}

interface WalkEntry {
	readonly path: string;
	readonly mtimeMs: number;
}

function walkMdFiles(deps: VaultOpsDeps): WalkEntry[] {
	const entries = deps.disk.readdirSync(deps.vaultRoot, {
		recursive: true,
		withFileTypes: true,
	}) as ReadonlyArray<{ name: string; isFile(): boolean; isDirectory(): boolean }>;

	const results: WalkEntry[] = [];

	for (const entry of entries) {
		if (!entry.isFile()) continue;

		const name = entry.name;
		if (!name.endsWith(".md")) continue;

		// Skip .flowti and .obsidian directories
		if (name.startsWith(".flowti/") || name.startsWith(".flowti\\")) continue;
		if (name.startsWith(".obsidian/") || name.startsWith(".obsidian\\")) continue;

		const fullPath = deps.paths.join(deps.vaultRoot, name);
		const stat = deps.disk.statSync(fullPath);
		results.push({ path: name, mtimeMs: stat.mtimeMs });
	}

	return results;
}

function parseFileTags(deps: VaultOpsDeps, relPath: string): readonly string[] {
	try {
		const fullPath = deps.paths.join(deps.vaultRoot, relPath);
		const content = deps.disk.readFileSync(fullPath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		const tags = frontmatter["tags"];
		if (Array.isArray(tags)) {
			return tags.filter((t): t is string => typeof t === "string");
		}
		return [];
	} catch {
		return [];
	}
}

function deriveFolderMap(fileIndex: readonly FileIndexEntry[]): FolderEntry[] {
	const counts = new Map<string, number>();

	for (const entry of fileIndex) {
		const slashIdx = entry.path.indexOf("/");
		const folder = slashIdx === -1 ? "." : entry.path.slice(0, slashIdx);
		counts.set(folder, (counts.get(folder) ?? 0) + 1);
	}

	return [...counts.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([path, noteCount]) => ({ path, noteCount }));
}

function deriveTagIndex(fileIndex: readonly FileIndexEntry[]): TagEntry[] {
	const counts = new Map<string, number>();

	for (const entry of fileIndex) {
		for (const tag of entry.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.sort(([, a], [, b]) => b - a)
		.map(([tag, count]) => ({ tag, count }));
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build or incrementally update the vault context cache.
 *
 * - Cold start (no existingCache): parse ALL files.
 * - Warm start: compare mtimes, re-parse only changed files.
 */
export function loadOrBuildCache(
	deps: VaultOpsDeps,
	existingCache?: VaultContextCache,
): VaultContextCache {
	const walked = walkMdFiles(deps);

	let fileIndex: FileIndexEntry[];

	if (!existingCache) {
		// Cold start — parse everything
		fileIndex = walked.map((w) => ({
			path: w.path,
			mtimeMs: w.mtimeMs,
			tags: parseFileTags(deps, w.path),
		}));
	} else {
		// Warm start — reuse unchanged, re-parse modified/new
		const cachedByPath = new Map<string, FileIndexEntry>();
		for (const entry of existingCache.fileIndex) {
			cachedByPath.set(entry.path, entry);
		}

		fileIndex = walked.map((w) => {
			const cached = cachedByPath.get(w.path);
			if (cached && cached.mtimeMs === w.mtimeMs) {
				return cached;
			}
			return {
				path: w.path,
				mtimeMs: w.mtimeMs,
				tags: parseFileTags(deps, w.path),
			};
		});
	}

	const folderMap = deriveFolderMap(fileIndex);
	const tagIndex = deriveTagIndex(fileIndex);

	const cache: VaultContextCache = {
		version: CACHE_VERSION,
		builtAt: deps.clock.iso(),
		folderMap,
		tagIndex,
		fileIndex,
	};

	// Persist cache to disk
	const cp = cachePath(deps);
	const dir = deps.paths.dirname(cp);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(cp, JSON.stringify(cache, null, "\t"));

	return cache;
}

/**
 * Build a VaultContext by loading (or creating) the cache and
 * deriving recent changes and scope filtering.
 */
export function buildVaultContext(
	deps: VaultOpsDeps,
	scope?: VaultScope,
): VaultContext {
	let existingCache: VaultContextCache | undefined;

	const cp = cachePath(deps);
	if (deps.disk.existsSync(cp)) {
		try {
			const raw = deps.disk.readFileSync(cp, "utf-8");
			existingCache = JSON.parse(raw) as VaultContextCache;
		} catch {
			existingCache = undefined;
		}
	}

	const cache = loadOrBuildCache(deps, existingCache);

	// Build recentChanges from fileIndex sorted by mtime desc
	const sorted = [...cache.fileIndex].sort((a, b) => b.mtimeMs - a.mtimeMs);
	const recentChanges: RecentChange[] = sorted.slice(0, MAX_RECENT).map((entry) => ({
		path: entry.path,
		action: "modified" as const,
		at: new Date(entry.mtimeMs).toISOString(),
	}));

	const ctx: VaultContext = {
		folderMap: cache.folderMap,
		tagIndex: cache.tagIndex,
		recentChanges,
	};

	return filterByScope(ctx, scope);
}

/** Filter a VaultContext to only entries matching the given scope. */
export function filterByScope(ctx: VaultContext, scope?: VaultScope): VaultContext {
	if (!scope) return ctx;

	let folderMap = ctx.folderMap;
	let tagIndex = ctx.tagIndex;

	if (scope.folders && scope.folders.length > 0) {
		const prefixes = scope.folders;
		folderMap = ctx.folderMap.filter((entry) =>
			prefixes.some((prefix) => entry.path === prefix || entry.path.startsWith(prefix + "/")),
		);
	}

	if (scope.tags && scope.tags.length > 0) {
		const prefixes = scope.tags;
		tagIndex = ctx.tagIndex.filter((entry) =>
			prefixes.some((prefix) => entry.tag === prefix || entry.tag.startsWith(prefix + "/")),
		);
	}

	return {
		folderMap,
		tagIndex,
		recentChanges: ctx.recentChanges,
	};
}

/** Delete the cache file if it exists. */
export function invalidateContextCache(deps: VaultOpsDeps): void {
	const cp = cachePath(deps);
	if (deps.disk.existsSync(cp)) {
		deps.disk.rmSync(cp);
	}
}
