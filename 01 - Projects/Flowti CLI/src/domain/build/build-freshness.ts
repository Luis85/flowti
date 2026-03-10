/**
 * build-freshness.ts — Detect source changes vs compiled output.
 *
 * Uses SHA-256 content hashing to determine whether a rebuild is needed.
 * Stores a build manifest (.build-manifest.json) alongside the binary.
 * Pure logic — all I/O goes through the injected filesystem.
 */

import { createHash } from "node:crypto";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";

// ── Path defaults ─────────────────────────────────────────────────────

/** Resolve source and output directories for a project (centralised defaults). */
export function resolveBuildPaths(projectPath: string): { srcDir: string; binDir: string } {
	return {
		srcDir: paths.join(projectPath, "src"),
		binDir: paths.join(projectPath, "dist"),
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
	fs: { readdirSync: typeof disk.readdirSync; readFileSync: typeof disk.readFileSync; existsSync: typeof disk.existsSync } = disk,
): Record<string, string> {
	const hashes: Record<string, string> = {};
	if (!fs.existsSync(srcDir)) return hashes;

	function walk(dir: string): void {
		const entries = fs.readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory(): boolean; isFile(): boolean }[];
		for (const entry of entries) {
			const fullPath = paths.join(dir, entry.name);
			if (entry.isDirectory() && entry.name !== "node_modules") {
				walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(".ts")) {
				const relPath = paths.relative(srcDir, fullPath);
				const content = fs.readFileSync(fullPath, "utf-8");
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

export function manifestPath(binDir: string): string {
	return paths.join(binDir, MANIFEST_NAME);
}

export function loadManifest(
	binDir: string,
	fs: { existsSync: typeof disk.existsSync; readFileSync: typeof disk.readFileSync } = disk,
): BuildManifest | null {
	const mp = manifestPath(binDir);
	if (!fs.existsSync(mp)) return null;
	try {
		return JSON.parse(fs.readFileSync(mp, "utf-8")) as BuildManifest;
	} catch {
		return null;
	}
}

export function saveManifest(
	binDir: string,
	manifest: BuildManifest,
	fs: { writeFileSync: typeof disk.writeFileSync; mkdirSync: typeof disk.mkdirSync } = disk,
): void {
	fs.mkdirSync(binDir, { recursive: true });
	fs.writeFileSync(manifestPath(binDir), JSON.stringify(manifest, null, "\t"), "utf-8");
}

export function createManifest(fileHashes: Record<string, string>): BuildManifest {
	return {
		builtAt: new Date().toISOString(),
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
	fs: {
		existsSync: typeof disk.existsSync;
		readFileSync: typeof disk.readFileSync;
		readdirSync: typeof disk.readdirSync;
	} = disk,
): FreshnessCheck {
	const manifest = loadManifest(binDir, fs);
	const currentHashes = collectSourceHashes(srcDir, fs);
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
	fs: {
		existsSync: typeof disk.existsSync;
		readFileSync: typeof disk.readFileSync;
		readdirSync: typeof disk.readdirSync;
		writeFileSync: typeof disk.writeFileSync;
		mkdirSync: typeof disk.mkdirSync;
	} = disk,
): BuildManifest {
	const hashes = collectSourceHashes(srcDir, fs);
	const manifest = createManifest(hashes);
	saveManifest(binDir, manifest, fs);
	return manifest;
}
