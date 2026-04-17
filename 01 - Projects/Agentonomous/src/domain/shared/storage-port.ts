import type { Result } from './result.js';

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
 */
export interface StoragePort {
	/** Load a value by key.  Returns `null` (wrapped in ok) if the key is absent. */
	loadJson(namespace: string, key: string): Promise<Result<unknown, string>>;

	/** Save a value.  Overwrites any existing value at the key. */
	saveJson(namespace: string, key: string, value: unknown): Promise<Result<void, string>>;

	/** Delete a key.  No-op if the key does not exist. */
	deleteKey(namespace: string, key: string): Promise<Result<void, string>>;

	/** List all keys in a namespace.  Returns `[]` if the namespace is empty or unknown. */
	listKeys(namespace: string): Promise<Result<string[], string>>;

	/** Remove an entire namespace and all its keys. */
	clearNamespace(namespace: string): Promise<Result<void, string>>;
}
