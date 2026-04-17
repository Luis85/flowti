import type { Result } from './result.js';
import type { AppError } from './app-error.js';

/**
 * Namespaced keyed JSON storage.
 *
 * Each namespace is a private bucket owned by one module.  Keys within a
 * namespace hold arbitrary JSON-serializable values.  Adapters may persist
 * to disk (Obsidian vault data folder), memory (tests), or any other
 * backing store — the port is platform-agnostic.
 *
 * Use this for structured per-module data (session transcripts, task logs,
 * cached analyses).  `SettingsPort` is for user-facing preferences only.
 *
 * Errors are returned as `AppError` (code/message/source/severity/cause)
 * matching the rest of the error surface.
 */
export interface StoragePort {
	/** Load a value by key.  Returns `null` (wrapped in ok) if the key is absent. */
	loadJson(namespace: string, key: string): Promise<Result<unknown, AppError>>;

	/** Save a value.  Overwrites any existing value at the key. */
	saveJson(namespace: string, key: string, value: unknown): Promise<Result<void, AppError>>;

	/** Delete a key.  No-op if the key does not exist. */
	deleteKey(namespace: string, key: string): Promise<Result<void, AppError>>;

	/** List all keys in a namespace.  Returns `[]` if the namespace is empty or unknown. */
	listKeys(namespace: string): Promise<Result<string[], AppError>>;

	/** Remove an entire namespace and all its keys. */
	clearNamespace(namespace: string): Promise<Result<void, AppError>>;
}
