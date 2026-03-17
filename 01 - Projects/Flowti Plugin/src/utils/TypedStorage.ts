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
/** Timing measurement callback for performance observability. */
export type StorageMeasure = (op: "loaded" | "saved", key: string, durationMs: number, sizeBytes: number) => void;

export class TypedStorage<T> implements ITypedStorage<T> {
	private onFallback?: (key: string, error: unknown) => void;
	private onMeasure?: StorageMeasure;

	constructor(
		private storage: IStorageProvider,
		private key: string,
		options?: { onFallback?: (key: string, error: unknown) => void; onMeasure?: StorageMeasure },
	) {
		this.onFallback = options?.onFallback;
		this.onMeasure = options?.onMeasure;
	}

	async load(): Promise<T | undefined> {
		const start = performance.now();
		const data = (await this.storage.load()) as Record<string, unknown> | null;
		const result = data?.[this.key] as T | undefined;
		if (this.onMeasure) {
			const sizeBytes = result !== undefined ? JSON.stringify(result).length : 0;
			this.onMeasure("loaded", this.key, performance.now() - start, sizeBytes);
		}
		return result;
	}

	async save(state: T): Promise<void> {
		const start = performance.now();
		await storageMutex.withLock("storage", async () => {
			const raw = await this.storage.load();
			const existingData = (raw !== null && typeof raw === "object" && !Array.isArray(raw))
				? raw as object
				: {};
			await this.storage.save({
				...existingData,
				[this.key]: state,
			});
		});
		if (this.onMeasure) {
			const sizeBytes = JSON.stringify(state).length;
			this.onMeasure("saved", this.key, performance.now() - start, sizeBytes);
		}
	}

	async safeLoad(fallback?: T): Promise<T | undefined> {
		try {
			return await this.load();
		} catch (err) {
			console.warn(`[Flowti] Storage fallback for key "${this.key}" — using defaults due to load failure:`, err);
			this.onFallback?.(this.key, err);
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
