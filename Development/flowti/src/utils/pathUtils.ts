/**
 * General-purpose path utilities for vault-style forward-slash paths.
 *
 * Replaces 75+ inline `.split("/").pop()` and `.replace(/\.md$/, "")` patterns
 * scattered across the codebase (TD-18).
 */

/** Normalises backslashes to forward slashes. */
export function normalizeSeparators(path: string): string {
	return path.replace(/\\/g, "/");
}

/** Returns the last segment of a path (the filename). */
export function basename(path: string): string {
	const normalized = normalizeSeparators(path);
	return normalized.split("/").pop() ?? path;
}

/** Returns everything before the last `/`. Returns `""` for root-level files. */
export function dirname(path: string): string {
	const normalized = normalizeSeparators(path);
	const idx = normalized.lastIndexOf("/");
	return idx === -1 ? "" : normalized.slice(0, idx);
}

/**
 * Strips a file extension from a filename.
 * If `ext` is provided (e.g. `".md"`), only that extension is removed.
 * Otherwise removes any trailing `.xxx` extension.
 */
export function stripExtension(filename: string, ext?: string): string {
	if (ext) {
		return filename.endsWith(ext)
			? filename.slice(0, -ext.length)
			: filename;
	}
	const dotIdx = filename.lastIndexOf(".");
	return dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
}
