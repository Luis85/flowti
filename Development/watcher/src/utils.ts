import type { FolderMapping } from "./types";

/**
 * Truncates a path string for display purposes.
 * Shows the last `maxLength` characters with ellipsis prefix if truncated.
 */
export function truncatePath(path: string, maxLength = 60): string {
	if (!path) return "(not set)";
	return path.length > maxLength ? `…${path.slice(-maxLength)}` : path;
}

/**
 * Gets a display label for a folder mapping.
 * Returns description if set, otherwise falls back to id.
 */
export function getMappingLabel(mapping: FolderMapping): string {
	return mapping.description?.trim() || mapping.id;
}

/**
 * Normalizes a path to use forward slashes (vault-style).
 */
export function toVaultPath(p: string): string {
	return p.replace(/\\/g, "/");
}

export function makeId(): string {
	return crypto.randomUUID?.() ?? String(Date.now());
}

/**
 * Checks if a file is a temporary file that should be ignored.
 * Handles OneDrive, Dropbox, Office lock files, and common temp patterns.
 *
 * @param fileName - The file name (basename) or full path to check
 * @returns true if the file should be ignored
 */
export function isTempFile(fileName: string): boolean {
	// Extract basename if full path provided
	const name = fileName.includes("/") || fileName.includes("\\")
		? fileName.split(/[/\\]/).pop()?.toLowerCase() ?? ""
		: fileName.toLowerCase();

	// Office lock files (~$file.docx)
	if (name.startsWith("~$")) return true;

	// Generic temp files without extension (~filename)
	if (name.startsWith("~") && !name.includes(".")) return true;

	// Temp file extensions
	if (name.endsWith(".tmp")) return true;
	if (name.endsWith(".temp")) return true;
	if (name.endsWith(".swp")) return true;
	if (name.endsWith(".partial")) return true;
	if (name.endsWith(".crdownload")) return true;

	// System files
	if (name === "thumbs.db") return true;
	if (name === ".ds_store") return true;
	if (name === "desktop.ini") return true;

	return false;
}

/**
 * Creates a matcher function for chokidar's ignored option.
 * Filters dotfiles and optionally temp files.
 *
 * @param ignoreTemp - Whether to also ignore temp files
 * @returns A matcher function for chokidar
 */
export function createIgnoredMatcher(ignoreTemp: boolean): (path: string) => boolean {
	const ignoreDotfiles = /(^|[/\\])\../;

	if (!ignoreTemp) {
		return (p: string) => ignoreDotfiles.test(p);
	}

	return (p: string) => {
		if (ignoreDotfiles.test(p)) return true;
		const name = p.split(/[/\\]/).pop() ?? "";
		return isTempFile(name);
	};
}
