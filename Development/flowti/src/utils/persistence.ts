/**
 * Shared persistence helpers for domain services.
 *
 * All services share the same read-merge-write pattern when persisting state
 * under a named key in the shared storage object. These helpers eliminate that
 * boilerplate.
 */

import type { IStorageProvider } from "./types";

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
	const existingData = ((await storage.load()) as object) || {};
	await storage.save({
		...existingData,
		[key]: state,
	});
}
