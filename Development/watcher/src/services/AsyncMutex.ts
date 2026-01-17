/**
 * AsyncMutex - A simple async mutex for coordinating concurrent operations.
 *
 * Provides:
 * - Exclusive locks (only one holder at a time)
 * - Per-key locks (for file-level locking)
 * - Timeout support with context for better debugging
 * - FIFO ordering (first waiter gets lock first)
 */
export class AsyncMutex {
	private locked = false;
	private queue: Array<{
		resolve: () => void;
		reject: (err: Error) => void;
		timeoutId?: number;
	}> = [];

	/**
	 * Acquire the lock. Returns a release function.
	 * @param timeout Optional timeout in ms. Rejects if lock not acquired within timeout.
	 * @param context Optional context string for better error messages (e.g., "file-sync", "reconcile")
	 */
	async acquire(timeout?: number, context?: string): Promise<() => void> {
		if (!this.locked) {
			this.locked = true;
			return () => this.release();
		}

		return new Promise<() => void>((resolve, reject) => {
			const waiter = {
				resolve: () => resolve(() => this.release()),
				reject,
				timeoutId: undefined as number | undefined,
			};

			if (timeout !== undefined && timeout > 0) {
				const setTimeoutFn =
					typeof window !== "undefined" ? window.setTimeout : setTimeout;
				waiter.timeoutId = setTimeoutFn(() => {
					const idx = this.queue.indexOf(waiter);
					if (idx !== -1) {
						this.queue.splice(idx, 1);
						const contextInfo = context ? ` (context: ${context})` : "";
						reject(new Error(`AsyncMutex: timeout after ${timeout}ms waiting for lock${contextInfo}, queue length: ${this.queue.length}`));
					}
				}, timeout) as unknown as number;
			}

			this.queue.push(waiter);
		});
	}

	/**
	 * Try to acquire the lock without waiting.
	 * Returns release function if successful, undefined otherwise.
	 */
	tryAcquire(): (() => void) | undefined {
		if (!this.locked) {
			this.locked = true;
			return () => this.release();
		}
		return undefined;
	}

	/**
	 * Check if mutex is currently locked.
	 */
	isLocked(): boolean {
		return this.locked;
	}

	/**
	 * Get number of waiters in queue.
	 */
	queueLength(): number {
		return this.queue.length;
	}

	private release(): void {
		if (this.queue.length > 0) {
			const next = this.queue.shift()!;
			if (next.timeoutId) {
				const clearTimeoutFn =
					typeof window !== "undefined" ? window.clearTimeout : clearTimeout;
				clearTimeoutFn(next.timeoutId);
			}
			next.resolve();
		} else {
			this.locked = false;
		}
	}
}

/**
 * KeyedMutex - A mutex that supports per-key locking.
 *
 * Useful for file-level locking where you want to prevent concurrent
 * operations on the same file but allow different files to sync in parallel.
 */
export class KeyedMutex {
	private mutexes = new Map<string, AsyncMutex>();
	private refCounts = new Map<string, number>();

	/**
	 * Acquire lock for a specific key.
	 * @param key The key to lock (e.g., file path)
	 * @param timeout Optional timeout in ms
	 * @param context Optional context string for better error messages
	 */
	async acquire(key: string, timeout?: number, context?: string): Promise<() => void> {
		let mutex = this.mutexes.get(key);
		if (!mutex) {
			mutex = new AsyncMutex();
			this.mutexes.set(key, mutex);
			this.refCounts.set(key, 0);
		}

		this.refCounts.set(key, (this.refCounts.get(key) ?? 0) + 1);

		// Include key in context for better debugging
		const fullContext = context ? `${context} [key: ${key}]` : `key: ${key}`;
		const release = await mutex.acquire(timeout, fullContext);

		return () => {
			release();
			const count = (this.refCounts.get(key) ?? 1) - 1;
			this.refCounts.set(key, count);

			// Cleanup unused mutex
			if (count === 0 && !mutex!.isLocked()) {
				this.mutexes.delete(key);
				this.refCounts.delete(key);
			}
		};
	}

	/**
	 * Try to acquire lock for a key without waiting.
	 */
	tryAcquire(key: string): (() => void) | undefined {
		let mutex = this.mutexes.get(key);
		if (!mutex) {
			mutex = new AsyncMutex();
			this.mutexes.set(key, mutex);
			this.refCounts.set(key, 0);
		}

		const release = mutex.tryAcquire();
		if (!release) return undefined;

		this.refCounts.set(key, (this.refCounts.get(key) ?? 0) + 1);

		return () => {
			release();
			const count = (this.refCounts.get(key) ?? 1) - 1;
			this.refCounts.set(key, count);

			if (count === 0 && !mutex!.isLocked()) {
				this.mutexes.delete(key);
				this.refCounts.delete(key);
			}
		};
	}

	/**
	 * Check if a specific key is locked.
	 */
	isLocked(key: string): boolean {
		return this.mutexes.get(key)?.isLocked() ?? false;
	}

	/**
	 * Get total number of active keys.
	 */
	activeKeys(): number {
		return this.mutexes.size;
	}
}

/**
 * OperationLock - High-level lock for managing operation modes.
 *
 * Prevents conflicts between:
 * - Watcher file syncs (many concurrent allowed)
 * - Reconciliation (exclusive, blocks watchers)
 */
export class OperationLock {
	private mode: "idle" | "watching" | "reconciling" = "idle";
	private watcherCount = 0;
	private reconcileQueue: Array<{
		resolve: () => void;
		reject: (err: Error) => void;
	}> = [];
	private watcherQueue: Array<{
		resolve: () => void;
		reject: (err: Error) => void;
	}> = [];

	/**
	 * Acquire lock for a watcher sync operation.
	 * Multiple watchers can hold this simultaneously.
	 * Blocks if reconciliation is in progress.
	 */
	async acquireWatcher(): Promise<() => void> {
		if (this.mode === "reconciling") {
			// Wait for reconcile to finish
			await new Promise<void>((resolve, reject) => {
				this.watcherQueue.push({ resolve, reject });
			});
		}

		this.watcherCount++;
		this.mode = "watching";

		return () => {
			this.watcherCount--;
			if (this.watcherCount === 0) {
				this.mode = "idle";
				this.processReconcileQueue();
			}
		};
	}

	/**
	 * Try to acquire watcher lock without waiting.
	 */
	tryAcquireWatcher(): (() => void) | undefined {
		if (this.mode === "reconciling") {
			return undefined;
		}

		this.watcherCount++;
		this.mode = "watching";

		return () => {
			this.watcherCount--;
			if (this.watcherCount === 0) {
				this.mode = "idle";
				this.processReconcileQueue();
			}
		};
	}

	/**
	 * Acquire exclusive lock for reconciliation.
	 * Blocks until all watchers complete, then blocks new watchers.
	 */
	async acquireReconcile(): Promise<() => void> {
		if (this.mode === "reconciling") {
			// Another reconcile is running, queue up
			await new Promise<void>((resolve, reject) => {
				this.reconcileQueue.push({ resolve, reject });
			});
		}

		// Wait for watchers to drain
		if (this.watcherCount > 0) {
			await new Promise<void>((resolve) => {
				const setTimeoutFn =
					typeof window !== "undefined" ? window.setTimeout : setTimeout;
				const check = () => {
					if (this.watcherCount === 0) {
						resolve();
					} else {
						setTimeoutFn(check, 50);
					}
				};
				check();
			});
		}

		this.mode = "reconciling";

		return () => {
			this.mode = "idle";
			// Release waiting watchers first
			this.processWatcherQueue();
			// Then next reconcile if any
			this.processReconcileQueue();
		};
	}

	/**
	 * Check current operation mode.
	 */
	getMode(): "idle" | "watching" | "reconciling" {
		return this.mode;
	}

	/**
	 * Get number of active watcher operations.
	 */
	getWatcherCount(): number {
		return this.watcherCount;
	}

	private processReconcileQueue(): void {
		if (this.reconcileQueue.length > 0 && this.mode === "idle") {
			const next = this.reconcileQueue.shift()!;
			next.resolve();
		}
	}

	private processWatcherQueue(): void {
		while (this.watcherQueue.length > 0) {
			const next = this.watcherQueue.shift()!;
			next.resolve();
		}
	}
}
