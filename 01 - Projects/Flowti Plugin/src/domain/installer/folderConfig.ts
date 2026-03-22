/**
 * Versioned folder configuration for the IBDE installer.
 *
 * The default folder structure is loaded from `configs/folder-structure.json`,
 * the single source of truth for the IBDE vault layout.
 *
 * PBI-ONB-004, Cycle 46.
 */

import folderStructure from "../../../configs/folder-structure.json";

// ── Types ────────────────────────────────────────────────────────

export interface FolderConfigEntry {
	/** Vault-relative path (parent-first ordering). */
	path: string;
	/** Human-readable purpose shown in the wizard review page. */
	description: string;
}

export interface FolderConfig {
	version: number;
	description: string;
	folders: FolderConfigEntry[];
}

// ── Default config (loaded from configs/folder-structure.json) ───

export const DEFAULT_FOLDER_CONFIG: FolderConfig = folderStructure;

// ── Helpers ──────────────────────────────────────────────────────

/** Extract an ordered array of folder paths from the config (backwards-compatible with DEFAULT_IBDE_FOLDERS). */
export function getFolderPaths(config: FolderConfig): readonly string[] {
	return config.folders.map((f) => f.path);
}

/** Return only top-level folder entries (paths without a `/`). */
export function getTopLevelEntries(config: FolderConfig): FolderConfigEntry[] {
	return config.folders.filter((f) => !f.path.includes("/"));
}
