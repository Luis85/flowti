/**
 * Simple per-path mutex to serialize concurrent access to the same resource.
 * Prevents data loss when multiple operations target the same file path.
 */
export class PathMutex {
	private locks = new Map<string, Promise<void>>();

	/**
	 * Acquires the lock for a path, runs the callback, then releases.
	 * Concurrent calls for the same path are serialized; different paths run freely.
	 */
	async withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
		const prev = this.locks.get(path) ?? Promise.resolve();

		let release: () => void;
		const next = new Promise<void>((resolve) => {
			release = resolve;
		});
		this.locks.set(path, next);

		await prev;
		try {
			return await fn();
		} finally {
			release!();
			// Clean up if no other waiters queued
			if (this.locks.get(path) === next) {
				this.locks.delete(path);
			}
		}
	}
}
