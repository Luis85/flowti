/**
 * Shared persistence helpers for domain services.
 *
 * All services share the same read-merge-write pattern when persisting state
 * under a named key in the shared storage object. These helpers eliminate that
 * boilerplate.
 */

import type { IStorageProvider } from "./types";
import { PathMutex } from "./mutex";

/** Module-level mutex to serialise concurrent storage writes. */
const storageMutex = new PathMutex();

/**
 * Loads a named slice from the shared storage object.
 * Returns `undefined` if the key doesn't exist.
 */
export async function loadStateFromStorage<T>(
	storage: IStorageProvider,
	key: string,
): Promise<T | undefined> {
	const data = (await storage.load()) as Record<string, unknown> | null;
	return data?.[key] as T | undefined;
}

/**
 * Saves a named slice into the shared storage object using read-merge-write.
 * Preserves all other keys in the storage.
 */
export async function saveStateToStorage<T>(
	storage: IStorageProvider,
	key: string,
	state: T,
): Promise<void> {
	await storageMutex.withLock("storage", async () => {
		const existingData = ((await storage.load()) as object) || {};
		await storage.save({
			...existingData,
			[key]: state,
		});
	});
}

/**
 * Error-safe version of loadStateFromStorage.
 * Returns `fallback` (default `undefined`) on any storage error,
 * logging the error to console.
 */
export async function safeLoadState<T>(
	storage: IStorageProvider,
	key: string,
	fallback?: T,
): Promise<T | undefined> {
	try {
		return await loadStateFromStorage<T>(storage, key);
	} catch (err) {
		console.error(`[Flowti] Failed to load state for key "${key}":`, err);
		return fallback;
	}
}

/**
 * Error-safe version of saveStateToStorage.
 * Swallows storage errors, logging them to console.
 * Returns true on success, false on failure.
 */
export async function safeSaveState<T>(
	storage: IStorageProvider,
	key: string,
	state: T,
): Promise<boolean> {
	try {
		await saveStateToStorage(storage, key, state);
		return true;
	} catch (err) {
		console.error(`[Flowti] Failed to save state for key "${key}":`, err);
		return false;
	}
}
