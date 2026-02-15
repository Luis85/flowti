/**
 * Type-safe, key-scoped storage wrapper.
 *
 * Replaces the per-service boilerplate of calling `loadStateFromStorage()`
 * and `saveStateToStorage()` with a concise, typed API:
 *
 *   `const state = await this.storage.load();`
 *   `await this.storage.save(state);`
 *
 * Each instance binds to a single key inside the shared storage object,
 * ensuring services never accidentally overwrite each other's data.
 *
 * @see TD-16 — Duplicated storage merging pattern across 8+ services
 */

import type { IStorageProvider } from "./types";
import { PathMutex } from "./mutex";

/** Module-level mutex shared with persistence.ts to serialize writes. */
const storageMutex = new PathMutex();

/**
 * Minimal interface for typed, key-scoped storage.
 * Services depend on this interface, not the concrete class.
 */
export interface ITypedStorage<T> {
	load(): Promise<T | undefined>;
	save(state: T): Promise<void>;
	safeLoad(fallback?: T): Promise<T | undefined>;
	safeSave(state: T): Promise<boolean>;
}

/**
 * Concrete implementation backed by a shared `IStorageProvider`.
 *
 * - `load()` reads the shared object and extracts `data[key]`
 * - `save()` merges the state back under `data[key]` atomically
 */
export class TypedStorage<T> implements ITypedStorage<T> {
	constructor(
		private storage: IStorageProvider,
		private key: string,
	) {}

	async load(): Promise<T | undefined> {
		const data = (await this.storage.load()) as Record<string, unknown> | null;
		return data?.[this.key] as T | undefined;
	}

	async save(state: T): Promise<void> {
		await storageMutex.withLock("storage", async () => {
			const existingData = ((await this.storage.load()) as object) || {};
			await this.storage.save({
				...existingData,
				[this.key]: state,
			});
		});
	}

	async safeLoad(fallback?: T): Promise<T | undefined> {
		try {
			return await this.load();
		} catch (err) {
			console.error(`[Flowti] Failed to load state for key "${this.key}":`, err);
			return fallback;
		}
	}

	async safeSave(state: T): Promise<boolean> {
		try {
			await this.save(state);
			return true;
		} catch (err) {
			console.error(`[Flowti] Failed to save state for key "${this.key}":`, err);
			return false;
		}
	}
}
