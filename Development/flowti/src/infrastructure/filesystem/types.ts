/**
 * Type definitions for the FileSystem module.
 */

import type { IEventBus } from "../events/types";

/**
 * Options for creating a FileSystemClient.
 */
export interface FileSystemClientOptions {
	/** The event bus for communication */
	eventBus: IEventBus;
	/** Default timeout for operations in milliseconds (default: 5000) */
	timeout?: number;
}

/**
 * Options for file creation.
 */
export interface CreateFileOptions {
	/** Create parent folders if they don't exist */
	createFolders?: boolean;
	/** Custom timeout for this operation */
	timeout?: number;
}

/**
 * Options for file operations with timeout.
 */
export interface FileOperationOptions {
	/** Custom timeout for this operation */
	timeout?: number;
}

/**
 * Interface for the FileSystem client.
 * Provides a promise-based API for file operations via events.
 */
export interface IFileSystemClient {
	/**
	 * Check if a file exists.
	 * @param path - File path relative to vault root
	 * @returns true if the file exists
	 */
	fileExists(path: string, options?: FileOperationOptions): Promise<boolean>;

	/**
	 * Create a new file.
	 * @param path - File path relative to vault root
	 * @param content - File content
	 * @param options - Creation options
	 */
	createFile(
		path: string,
		content: string,
		options?: CreateFileOptions
	): Promise<void>;

	/**
	 * Read a file's content.
	 * @param path - File path relative to vault root
	 * @param options - Operation options
	 * @returns The file content
	 */
	readFile(path: string, options?: FileOperationOptions): Promise<string>;

	/**
	 * Update a file's content.
	 * @param path - File path relative to vault root
	 * @param content - New content
	 * @param options - Operation options
	 */
	updateFile(
		path: string,
		content: string,
		options?: FileOperationOptions
	): Promise<void>;

	/**
	 * Delete a file.
	 * @param path - File path relative to vault root
	 * @param options - Operation options
	 */
	deleteFile(path: string, options?: FileOperationOptions): Promise<void>;

	/**
	 * Move a file to a new location.
	 * @param path - Current file path
	 * @param newPath - Destination path
	 * @param options - Operation options
	 * @returns The new path after move
	 */
	moveFile(
		path: string,
		newPath: string,
		options?: FileOperationOptions
	): Promise<string>;

	/**
	 * Rename a file (same folder, different name).
	 * @param path - Current file path
	 * @param newName - New file name (without path)
	 * @param options - Operation options
	 * @returns The new path after rename
	 */
	renameFile(
		path: string,
		newName: string,
		options?: FileOperationOptions
	): Promise<string>;

	/**
	 * List files in a folder.
	 * @param folderPath - Folder path relative to vault root
	 * @param options - Operation options
	 * @returns Array of file paths within the folder
	 */
	listFiles(folderPath: string, options?: FileOperationOptions): Promise<string[]>;

	/**
	 * Ensure a folder exists, creating it (and parents) if necessary.
	 * @param folderPath - Folder path relative to vault root
	 * @param options - Operation options
	 */
	ensureFolder(folderPath: string, options?: FileOperationOptions): Promise<void>;

	/**
	 * Get frontmatter from a file.
	 * @param path - File path relative to vault root
	 * @param options - Operation options
	 * @returns The frontmatter data
	 */
	getFrontmatter(
		path: string,
		options?: FileOperationOptions
	): Promise<Record<string, unknown>>;

	/**
	 * Update (merge) frontmatter in a file.
	 * @param path - File path relative to vault root
	 * @param data - Partial frontmatter to merge
	 * @param options - Operation options
	 * @returns The updated frontmatter data
	 */
	updateFrontmatter(
		path: string,
		data: Record<string, unknown>,
		options?: FileOperationOptions
	): Promise<Record<string, unknown>>;

	/**
	 * Set (replace) frontmatter in a file.
	 * @param path - File path relative to vault root
	 * @param data - Complete frontmatter to set
	 * @param options - Operation options
	 */
	setFrontmatter(
		path: string,
		data: Record<string, unknown>,
		options?: FileOperationOptions
	): Promise<void>;
}
