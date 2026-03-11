/**
 * build-freshness.ts — Detect source changes vs compiled output.
 *
 * Uses SHA-256 content hashing to determine whether a rebuild is needed.
 * Stores a build manifest (.build-manifest.json) alongside the binary.
 * Pure logic — all I/O goes through the injected filesystem.
 */

import { createHash } from "node:crypto";
import type { CliDeps } from "../../infrastructure/deps.js";

export type FreshnessDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Path defaults ─────────────────────────────────────────────────────

/** Resolve source and output directories for a project (centralised defaults). */
export function resolveBuildPaths(projectPath: string, deps: Pick<FreshnessDeps, "paths">): { srcDir: string; binDir: string } {
	return {
		srcDir: deps.paths.join(projectPath, "src"),
		binDir: deps.paths.join(projectPath, "dist"),
	};
}

// ── Types ────────────────────────────────────────────────────────────

export interface BuildManifest {
	builtAt: string;
	sourceHash: string;
	fileCount: number;
	files: Record<string, string>;
}

export interface FreshnessCheck {
	needsRebuild: boolean;
	reason: string;
	added: string[];
	removed: string[];
	modified: string[];
	currentHash: string;
	manifestHash: string | null;
}

// ── Hashing ──────────────────────────────────────────────────────────

export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

/** Walk a directory recursively, collecting .ts files and their hashes. */
export function collectSourceHashes(
	srcDir: string,
	deps: Pick<FreshnessDeps, "disk" | "paths">,
): Record<string, string> {
	const hashes: Record<string, string> = {};
	if (!deps.disk.existsSync(srcDir)) return hashes;

	function walk(dir: string): void {
		const entries = deps.disk.readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory(): boolean; isFile(): boolean }[];
		for (const entry of entries) {
			const fullPath = deps.paths.join(dir, entry.name);
			if (entry.isDirectory() && entry.name !== "node_modules") {
				walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(".ts")) {
				const relPath = deps.paths.relative(srcDir, fullPath);
				const content = deps.disk.readFileSync(fullPath, "utf-8");
				hashes[relPath] = hashContent(content);
			}
		}
	}

	walk(srcDir);
	return hashes;
}

/** Compute a single aggregate hash from all file hashes (sorted by path). */
export function aggregateHash(fileHashes: Record<string, string>): string {
	const sorted = Object.keys(fileHashes).sort();
	const combined = sorted.map((k) => `${k}:${fileHashes[k]}`).join("\n");
	return hashContent(combined);
}

// ── Manifest ─────────────────────────────────────────────────────────

const MANIFEST_NAME = ".build-manifest.json";

export function manifestPath(binDir: string, deps: Pick<FreshnessDeps, "paths">): string {
	return deps.paths.join(binDir, MANIFEST_NAME);
}

export function loadManifest(
	binDir: string,
	deps: Pick<FreshnessDeps, "disk" | "paths">,
): BuildManifest | null {
	const mp = manifestPath(binDir, deps);
	if (!deps.disk.existsSync(mp)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(mp, "utf-8")) as BuildManifest;
	} catch {
		return null;
	}
}

export function saveManifest(
	binDir: string,
	manifest: BuildManifest,
	deps: Pick<FreshnessDeps, "disk" | "paths">,
): void {
	deps.disk.mkdirSync(binDir, { recursive: true });
	deps.disk.writeFileSync(manifestPath(binDir, deps), JSON.stringify(manifest, null, "\t"), "utf-8");
}

export function createManifest(fileHashes: Record<string, string>, deps: Pick<FreshnessDeps, "clock">): BuildManifest {
	return {
		builtAt: deps.clock.iso(),
		sourceHash: aggregateHash(fileHashes),
		fileCount: Object.keys(fileHashes).length,
		files: fileHashes,
	};
}

// ── Freshness check ──────────────────────────────────────────────────

function computeSourceDiff(
	currentHashes: Record<string, string>,
	manifestFiles: Record<string, string>,
): { added: string[]; removed: string[]; modified: string[]; reason: string } {
	const added: string[] = [];
	const removed: string[] = [];
	const modified: string[] = [];

	for (const file of Object.keys(currentHashes)) {
		if (!(file in manifestFiles)) {
			added.push(file);
		} else if (manifestFiles[file] !== currentHashes[file]) {
			modified.push(file);
		}
	}
	for (const file of Object.keys(manifestFiles)) {
		if (!(file in currentHashes)) {
			removed.push(file);
		}
	}

	const parts: string[] = [];
	if (added.length) parts.push(`${added.length} added`);
	if (modified.length) parts.push(`${modified.length} modified`);
	if (removed.length) parts.push(`${removed.length} removed`);
	const reason = `Source changes detected: ${parts.join(", ")}.`;

	return { added: added.sort(), removed: removed.sort(), modified: modified.sort(), reason };
}

export function checkFreshness(
	srcDir: string,
	binDir: string,
	deps: Pick<FreshnessDeps, "disk" | "paths">,
): FreshnessCheck {
	const manifest = loadManifest(binDir, deps);
	const currentHashes = collectSourceHashes(srcDir, deps);
	const currentHash = aggregateHash(currentHashes);

	if (!manifest) {
		return {
			needsRebuild: true,
			reason: "No build manifest found — first build or manifest deleted.",
			added: Object.keys(currentHashes).sort(),
			removed: [],
			modified: [],
			currentHash,
			manifestHash: null,
		};
	}

	if (manifest.sourceHash === currentHash) {
		return {
			needsRebuild: false,
			reason: "Build is up to date.",
			added: [],
			removed: [],
			modified: [],
			currentHash,
			manifestHash: manifest.sourceHash,
		};
	}

	const diff = computeSourceDiff(currentHashes, manifest.files);

	return {
		needsRebuild: true,
		reason: diff.reason,
		added: diff.added,
		removed: diff.removed,
		modified: diff.modified,
		currentHash,
		manifestHash: manifest.sourceHash,
	};
}

/** After a successful build, snapshot the current source state. */
export function recordBuild(
	srcDir: string,
	binDir: string,
	deps: Pick<FreshnessDeps, "disk" | "paths" | "clock">,
): BuildManifest {
	const hashes = collectSourceHashes(srcDir, deps);
	const manifest = createManifest(hashes, deps);
	saveManifest(binDir, manifest, deps);
	return manifest;
}
