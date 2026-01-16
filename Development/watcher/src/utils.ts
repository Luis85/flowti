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

/**
 * Shortens a path for display, showing "(not set)" if empty.
 */
export function shortPath(p: string, maxLength = 60): string {
	if (!p) return "(not set)";
	return p.length > maxLength ? `…${p.slice(-maxLength)}` : p;
}
