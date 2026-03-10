/**
 * scaffold-version.ts — Template versioning and update detection.
 *
 * Tracks which scaffold definition was used to create a project.
 * Detects changes between the original template output and the
 * current definition, enabling re-application with conflict resolution.
 */

import { createHash } from "node:crypto";
import { clock } from "../../infrastructure/clock.js";
import type { FileEntry } from "./scaffold-types.js";

// ── Types ────────────────────────────────────────────────────────────

/** Metadata stored in the project after scaffolding. */
export interface ScaffoldManifest {
	definitionId: string;
	createdAt: string;
	/** SHA-256 hash of each file at scaffold time, keyed by relative path. */
	fileHashes: Record<string, string>;
}

/** Result of comparing a scaffolded file against the updated template. */
export interface FileDiff {
	path: string;
	status: "unchanged" | "modified" | "added" | "removed" | "conflict";
	/** The new template content (null for removed files). */
	templateContent: string | null;
}

/** Outcome of the full update check. */
export interface UpdateCheck {
	definitionId: string;
	fileDiffs: FileDiff[];
	hasChanges: boolean;
	summary: string;
}

export type ConflictStrategy = "overwrite" | "skip" | "mark";

// ── Hashing ──────────────────────────────────────────────────────────

/** Compute SHA-256 hash of a string. */
export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

/** Build a file hash map from FileEntry[]. */
export function buildFileHashes(files: FileEntry[]): Record<string, string> {
	const hashes: Record<string, string> = {};
	for (const file of files) {
		hashes[file.path] = hashContent(file.content);
	}
	return hashes;
}

// ── Manifest ────────────────────────────────────────────────────────

/** Create a scaffold manifest from the initial scaffold output. */
export function createManifest(definitionId: string, files: FileEntry[]): ScaffoldManifest {
	return {
		definitionId,
		createdAt: clock.iso(),
		fileHashes: buildFileHashes(files),
	};
}

// ── Diff ────────────────────────────────────────────────────────────

function classifyFileDiff(
	newFile: FileEntry,
	manifest: ScaffoldManifest,
	currentFiles: Record<string, string>,
): FileDiff {
	const newHash = hashContent(newFile.content);
	const oldHash = manifest.fileHashes[newFile.path];
	const currentContent = currentFiles[newFile.path];

	if (!oldHash) {
		return { path: newFile.path, status: "added", templateContent: newFile.content };
	}
	if (newHash === oldHash) {
		return { path: newFile.path, status: "unchanged", templateContent: null };
	}
	if (currentContent === undefined) {
		return { path: newFile.path, status: "added", templateContent: newFile.content };
	}
	const currentHash = hashContent(currentContent);
	if (currentHash === oldHash) {
		return { path: newFile.path, status: "modified", templateContent: newFile.content };
	}
	return { path: newFile.path, status: "conflict", templateContent: newFile.content };
}

function buildDiffSummary(diffs: FileDiff[]): { hasChanges: boolean; summary: string } {
	const hasChanges = diffs.some((d) => d.status !== "unchanged");
	const counts = {
		modified: diffs.filter((d) => d.status === "modified").length,
		added: diffs.filter((d) => d.status === "added").length,
		removed: diffs.filter((d) => d.status === "removed").length,
		conflict: diffs.filter((d) => d.status === "conflict").length,
		unchanged: diffs.filter((d) => d.status === "unchanged").length,
	};

	const parts: string[] = [];
	if (counts.modified > 0) parts.push(`${counts.modified} modified`);
	if (counts.added > 0) parts.push(`${counts.added} added`);
	if (counts.removed > 0) parts.push(`${counts.removed} removed`);
	if (counts.conflict > 0) parts.push(`${counts.conflict} conflict${counts.conflict > 1 ? "s" : ""}`);
	if (counts.unchanged > 0) parts.push(`${counts.unchanged} unchanged`);
	const summary = hasChanges ? parts.join(", ") : "No changes detected.";

	return { hasChanges, summary };
}

/**
 * Compare the current project state against an updated scaffold plan.
 *
 * @param manifest - The stored scaffold manifest (from initial scaffold)
 * @param newPlan - The new scaffold plan from the updated definition
 * @param currentFiles - Current file contents keyed by relative path (read from disk)
 */
export function diffScaffold(
	manifest: ScaffoldManifest,
	newPlan: FileEntry[],
	currentFiles: Record<string, string>,
): UpdateCheck {
	const diffs: FileDiff[] = [];
	const newPaths = new Set(newPlan.map((f) => f.path));
	const oldPaths = new Set(Object.keys(manifest.fileHashes));

	for (const newFile of newPlan) {
		diffs.push(classifyFileDiff(newFile, manifest, currentFiles));
	}

	for (const oldPath of oldPaths) {
		if (!newPaths.has(oldPath)) {
			diffs.push({ path: oldPath, status: "removed", templateContent: null });
		}
	}

	const { hasChanges, summary } = buildDiffSummary(diffs);

	return {
		definitionId: manifest.definitionId,
		fileDiffs: diffs,
		hasChanges,
		summary,
	};
}

// ── Conflict resolution ─────────────────────────────────────────────

/** Generate conflict markers for a file with both user and template changes. */
export function markConflict(currentContent: string, templateContent: string): string {
	return [
		"<<<<<<< current (your changes)",
		currentContent,
		"=======",
		templateContent,
		">>>>>>> template (updated)",
	].join("\n");
}

function resolveConflict(
	diff: FileDiff,
	currentFiles: Record<string, string>,
	strategy: ConflictStrategy,
): FileEntry | null {
	if (strategy === "overwrite" && diff.templateContent) {
		return { path: diff.path, content: diff.templateContent };
	}
	if (strategy === "mark" && diff.templateContent) {
		const current = currentFiles[diff.path] ?? "";
		return { path: diff.path, content: markConflict(current, diff.templateContent) };
	}
	// strategy === "skip" → do nothing
	return null;
}

/**
 * Resolve file diffs into a list of files to write, based on the conflict strategy.
 *
 * @returns Files to write, plus the updated manifest hashes.
 */
export function resolveUpdates(
	diffs: FileDiff[],
	currentFiles: Record<string, string>,
	strategy: ConflictStrategy,
): { toWrite: FileEntry[]; toDelete: string[] } {
	const toWrite: FileEntry[] = [];
	const toDelete: string[] = [];

	for (const diff of diffs) {
		switch (diff.status) {
			case "unchanged":
				break;
			case "added":
			case "modified":
				if (diff.templateContent) {
					toWrite.push({ path: diff.path, content: diff.templateContent });
				}
				break;
			case "removed":
				toDelete.push(diff.path);
				break;
			case "conflict": {
				const resolved = resolveConflict(diff, currentFiles, strategy);
				if (resolved) toWrite.push(resolved);
				break;
			}
		}
	}

	return { toWrite, toDelete };
}
