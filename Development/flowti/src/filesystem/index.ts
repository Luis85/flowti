/**
 * FileSystem module - Event-driven file operations for Obsidian.
 *
 * This module provides a decoupled way for services to perform file operations
 * without directly accessing the Obsidian API. All operations are performed
 * via the EventBus.
 *
 * @example
 * ```typescript
 * import { FileSystemClient } from "./filesystem";
 *
 * const client = new FileSystemClient({ eventBus });
 * await client.createFile("notes/note.md", "# Hello");
 * ```
 */

export { FileSystemClient } from "./FileSystemClient";
export type {
	IFileSystemClient,
	FileSystemClientOptions,
	CreateFileOptions,
	FileOperationOptions,
} from "./types";
