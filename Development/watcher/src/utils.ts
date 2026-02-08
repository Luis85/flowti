import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
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

/**
 * Converts a simple glob pattern to a RegExp.
 * Supports:
 * - `*` matches any characters except path separators
 * - `**` matches any characters including path separators (recursive)
 * - `?` matches a single character
 * - Literal strings match exactly
 *
 * @param pattern - The glob pattern
 * @returns A RegExp that matches the pattern
 */
function globToRegex(pattern: string): RegExp {
	// Normalize path separators
	const normalized = pattern.replace(/\\/g, "/");

	// Escape regex special chars except *, ?, and /
	let regex = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");

	// Replace ** with a placeholder
	regex = regex.replace(/\*\*/g, "\0DOUBLESTAR\0");

	// Replace * with non-separator match
	regex = regex.replace(/\*/g, "[^/]*");

	// Replace ? with single char match
	regex = regex.replace(/\?/g, "[^/]");

	// Replace placeholder with any-char match
	regex = regex.replace(/\0DOUBLESTAR\0/g, ".*");

	return new RegExp(`^${regex}$`, "i");
}

/**
 * Checks if a path matches any of the exclusion patterns.
 * Patterns are matched against both the full relative path and basename.
 *
 * @param relativePath - The relative path to check (forward slashes)
 * @param patterns - Array of exclusion patterns
 * @returns true if the path should be excluded
 */
export function matchesExcludePattern(relativePath: string, patterns: string[]): boolean {
	if (!patterns || patterns.length === 0) return false;

	// Normalize path to forward slashes
	const normalizedPath = relativePath.replace(/\\/g, "/");
	const pathParts = normalizedPath.split("/");
	const basename = pathParts[pathParts.length - 1];

	for (const pattern of patterns) {
		if (!pattern.trim()) continue;

		const trimmedPattern = pattern.trim();

		// Simple name match (no path separators in pattern)
		if (!trimmedPattern.includes("/")) {
			// Check if any path segment matches
			const patternRegex = globToRegex(trimmedPattern);
			for (const part of pathParts) {
				if (patternRegex.test(part)) return true;
			}
			continue;
		}

		// Path pattern - check against full path
		const patternRegex = globToRegex(trimmedPattern);

		// Try matching the full path
		if (patternRegex.test(normalizedPath)) return true;

		// Also try matching from any position in the path
		for (let i = 0; i < pathParts.length; i++) {
			const subPath = pathParts.slice(i).join("/");
			if (patternRegex.test(subPath)) return true;
		}
	}

	return false;
}

/**
 * Creates an exclusion matcher function for a mapping.
 *
 * @param mapping - The folder mapping with exclude patterns
 * @returns A function that returns true if a path should be excluded
 */
export function createExclusionMatcher(
	mapping: { excludePatterns?: string[] }
): (relativePath: string) => boolean {
	const patterns = mapping.excludePatterns ?? [];
	if (patterns.length === 0) {
		return () => false;
	}
	return (relativePath: string) => matchesExcludePattern(relativePath, patterns);
}

/**
 * Checks if a file path is allowed by the extension filter list.
 * When the filter is empty, all files are allowed. When active,
 * files without an extension are rejected.
 *
 * @param filePath - The file path (or basename) to check
 * @param extensions - Array of allowed extensions (e.g. [".md", ".txt"])
 * @returns true if the file is allowed
 */
export function isAllowedByExtensions(filePath: string, extensions: string[]): boolean {
	if (extensions.length === 0) return true;
	const ext = path.extname(filePath).toLowerCase();
	if (!ext) return false;
	return extensions.includes(ext);
}

/**
 * Checks if a relative path matches any of the exclusion patterns.
 *
 * @param relativePath - The relative path to check (forward slashes)
 * @param patterns - Array of exclusion patterns
 * @returns true if the path should be excluded
 */
export function isPathExcluded(relativePath: string, patterns: string[]): boolean {
	if (patterns.length === 0) return false;
	return matchesExcludePattern(relativePath, patterns);
}

/**
 * Result of symlink detection.
 */
export interface SymlinkCheckResult {
	/** Whether the path is a symlink */
	isSymlink: boolean;
	/** The target path if it's a symlink (resolved) */
	target?: string;
	/** Error message if check failed */
	error?: string;
}

/**
 * Checks if a path is a symbolic link (async version).
 * Safe to call on any path - returns false if path doesn't exist or on error.
 *
 * @param filePath - The path to check
 * @returns SymlinkCheckResult with isSymlink flag and optional target
 */
export async function checkSymlink(filePath: string): Promise<SymlinkCheckResult> {
	try {
		const stat = await fsp.lstat(filePath);
		if (stat.isSymbolicLink()) {
			try {
				const target = await fsp.readlink(filePath);
				return { isSymlink: true, target };
			} catch {
				return { isSymlink: true };
			}
		}
		return { isSymlink: false };
	} catch (e) {
		// Path doesn't exist or permission denied
		return { isSymlink: false, error: String(e) };
	}
}

/**
 * Checks if a path is a symbolic link (sync version).
 * Safe to call on any path - returns false if path doesn't exist or on error.
 *
 * @param filePath - The path to check
 * @returns true if the path is a symlink
 */
export function isSymlinkSync(filePath: string): boolean {
	try {
		const stat = fs.lstatSync(filePath);
		return stat.isSymbolicLink();
	} catch {
		return false;
	}
}

/**
 * Checks if a directory contains any symlinks (non-recursive, first-level only).
 * Used for quick validation of source/target folders.
 *
 * @param dirPath - The directory to check
 * @returns Object with hasSymlinks flag and list of symlink names
 */
export async function checkDirectoryForSymlinks(
	dirPath: string
): Promise<{ hasSymlinks: boolean; symlinks: string[] }> {
	const symlinks: string[] = [];
	try {
		const entries = await fsp.readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isSymbolicLink()) {
				symlinks.push(entry.name);
			}
		}
		return { hasSymlinks: symlinks.length > 0, symlinks };
	} catch {
		return { hasSymlinks: false, symlinks: [] };
	}
}
