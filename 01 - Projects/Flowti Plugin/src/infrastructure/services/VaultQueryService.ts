/**
 * VaultQueryService — synchronous, read-only abstraction over Obsidian's
 * vault and metadataCache APIs.
 *
 * UI components use this service instead of accessing `app.vault` or
 * `app.metadataCache` directly, keeping the EventBridge boundary intact.
 *
 * Designed for high-frequency synchronous queries; async operations
 * (file create/read/write/delete) go through FileSystemClient + EventBridge.
 */

/**
 * Lightweight file info returned by vault queries.
 * Avoids leaking Obsidian TFile/TFolder types to consumers.
 */
export interface VaultFileEntry {
	path: string;
	name: string;
	basename: string;
	extension: string;
}

export interface VaultFolderEntry {
	path: string;
	name: string;
}

export interface VaultChildEntry {
	path: string;
	name: string;
	isFolder: boolean;
	extension?: string;
}

/**
 * Read-only vault query interface.
 * All methods are synchronous unless marked otherwise.
 */
export interface IVaultQueryService {
	/** Check if a file or folder exists at the given path. */
	fileExists(path: string): boolean;

	/** Get file info by path. Returns null if not found or is a folder. */
	getFile(path: string): VaultFileEntry | null;

	/** Check if the path points to a folder. */
	isFolder(path: string): boolean;

	/** Check if the path points to a file (not folder). */
	isFile(path: string): boolean;

	/** Get cached frontmatter for a file. Returns undefined if not cached or not a file. */
	getFrontmatter(path: string): Record<string, unknown> | undefined;

	/** List immediate children of a folder. Returns empty array if path is not a folder. */
	getChildren(folderPath: string): VaultChildEntry[];

	/** List markdown files in a folder. Returns empty array if path is not a folder. */
	listMarkdownFiles(folderPath: string): VaultFileEntry[];

	/** Read file content (async — delegates to vault.read). */
	readFile(path: string): Promise<string>;
}
