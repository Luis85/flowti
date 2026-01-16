import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AsyncMutex, KeyedMutex, OperationLock } from "../../src/services/AsyncMutex";

describe("AsyncMutex", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("basic locking", () => {
		it("should acquire lock immediately when not locked", async () => {
			const mutex = new AsyncMutex();

			expect(mutex.isLocked()).toBe(false);
			const release = await mutex.acquire();
			expect(mutex.isLocked()).toBe(true);

			release();
			expect(mutex.isLocked()).toBe(false);
		});

		it("should queue waiters when locked", async () => {
			const mutex = new AsyncMutex();
			const order: number[] = [];

			const release1 = await mutex.acquire();
			order.push(1);

			// Start second acquire (will be queued)
			const promise2 = mutex.acquire().then((release) => {
				order.push(2);
				return release;
			});

			// Start third acquire (will be queued)
			const promise3 = mutex.acquire().then((release) => {
				order.push(3);
				return release;
			});

			expect(mutex.queueLength()).toBe(2);

			// Release first lock
			release1();

			// Let promises resolve
			const release2 = await promise2;
			expect(order).toEqual([1, 2]);

			release2();
			const release3 = await promise3;
			expect(order).toEqual([1, 2, 3]);

			release3();
			expect(mutex.isLocked()).toBe(false);
			expect(mutex.queueLength()).toBe(0);
		});

		it("should maintain FIFO order", async () => {
			const mutex = new AsyncMutex();
			const order: string[] = [];

			const release1 = await mutex.acquire();

			const promises = ["A", "B", "C"].map((name) =>
				mutex.acquire().then((release) => {
					order.push(name);
					release();
				})
			);

			release1();
			await Promise.all(promises);

			expect(order).toEqual(["A", "B", "C"]);
		});
	});

	describe("tryAcquire", () => {
		it("should return release function when not locked", () => {
			const mutex = new AsyncMutex();

			const release = mutex.tryAcquire();
			expect(release).toBeDefined();
			expect(mutex.isLocked()).toBe(true);

			release!();
			expect(mutex.isLocked()).toBe(false);
		});

		it("should return undefined when locked", async () => {
			const mutex = new AsyncMutex();

			const release = await mutex.acquire();
			const tryResult = mutex.tryAcquire();

			expect(tryResult).toBeUndefined();

			release();
		});
	});

	describe("timeout", () => {
		it("should reject if timeout expires", async () => {
			const mutex = new AsyncMutex();

			// Hold the lock
			await mutex.acquire();

			// Try to acquire with timeout
			const acquirePromise = mutex.acquire(100);

			// Advance time past timeout
			vi.advanceTimersByTime(150);

			await expect(acquirePromise).rejects.toThrow("timeout after 100ms");
		});

		it("should not reject if lock acquired before timeout", async () => {
			const mutex = new AsyncMutex();

			const release1 = await mutex.acquire();

			// Start waiting with timeout
			const acquirePromise = mutex.acquire(1000);

			// Release before timeout
			vi.advanceTimersByTime(100);
			release1();

			const release2 = await acquirePromise;
			expect(release2).toBeDefined();

			release2();
		});

		it("should remove waiter from queue on timeout", async () => {
			const mutex = new AsyncMutex();

			await mutex.acquire();
			expect(mutex.queueLength()).toBe(0);

			const acquirePromise = mutex.acquire(100);
			expect(mutex.queueLength()).toBe(1);

			vi.advanceTimersByTime(150);

			await expect(acquirePromise).rejects.toThrow();
			expect(mutex.queueLength()).toBe(0);
		});
	});
});

describe("KeyedMutex", () => {
	describe("per-key locking", () => {
		it("should allow concurrent locks on different keys", async () => {
			const mutex = new KeyedMutex();

			const releaseA = await mutex.acquire("keyA");
			const releaseB = await mutex.acquire("keyB");

			expect(mutex.isLocked("keyA")).toBe(true);
			expect(mutex.isLocked("keyB")).toBe(true);
			expect(mutex.activeKeys()).toBe(2);

			releaseA();
			releaseB();

			expect(mutex.isLocked("keyA")).toBe(false);
			expect(mutex.isLocked("keyB")).toBe(false);
		});

		it("should block concurrent locks on same key", async () => {
			const mutex = new KeyedMutex();
			const order: number[] = [];

			const release1 = await mutex.acquire("same");
			order.push(1);

			const promise2 = mutex.acquire("same").then((release) => {
				order.push(2);
				return release;
			});

			// Second acquire should be blocked
			await Promise.resolve(); // Let microtasks run
			expect(order).toEqual([1]);

			release1();
			const release2 = await promise2;
			expect(order).toEqual([1, 2]);

			release2();
		});

		it("should cleanup unused mutexes", async () => {
			const mutex = new KeyedMutex();

			const release = await mutex.acquire("temp");
			expect(mutex.activeKeys()).toBe(1);

			release();
			expect(mutex.activeKeys()).toBe(0);
		});

		it("should not cleanup mutex while waiters exist", async () => {
			const mutex = new KeyedMutex();

			const release1 = await mutex.acquire("key");
			const promise2 = mutex.acquire("key");

			expect(mutex.activeKeys()).toBe(1);

			release1();
			const release2 = await promise2;

			// Still has one active lock
			expect(mutex.activeKeys()).toBe(1);

			release2();
			expect(mutex.activeKeys()).toBe(0);
		});
	});

	describe("tryAcquire", () => {
		it("should work per-key", async () => {
			const mutex = new KeyedMutex();

			await mutex.acquire("locked");

			const tryLocked = mutex.tryAcquire("locked");
			const tryUnlocked = mutex.tryAcquire("unlocked");

			expect(tryLocked).toBeUndefined();
			expect(tryUnlocked).toBeDefined();

			tryUnlocked!();
		});
	});
});

describe("OperationLock", () => {
	describe("watcher operations", () => {
		it("should allow multiple concurrent watchers", async () => {
			const lock = new OperationLock();

			const release1 = await lock.acquireWatcher();
			const release2 = await lock.acquireWatcher();
			const release3 = await lock.acquireWatcher();

			expect(lock.getMode()).toBe("watching");
			expect(lock.getWatcherCount()).toBe(3);

			release1();
			expect(lock.getWatcherCount()).toBe(2);

			release2();
			release3();
			expect(lock.getMode()).toBe("idle");
			expect(lock.getWatcherCount()).toBe(0);
		});

		it("should block watchers during reconcile", async () => {
			const lock = new OperationLock();
			const order: string[] = [];

			// Start reconcile
			const releaseReconcile = await lock.acquireReconcile();
			order.push("reconcile-start");

			expect(lock.getMode()).toBe("reconciling");

			// Watcher should be blocked
			const watcherPromise = lock.acquireWatcher().then((release) => {
				order.push("watcher-acquired");
				return release;
			});

			// Let microtasks run
			await Promise.resolve();
			expect(order).toEqual(["reconcile-start"]);

			// Release reconcile
			releaseReconcile();
			order.push("reconcile-end");

			const releaseWatcher = await watcherPromise;
			expect(order).toEqual(["reconcile-start", "reconcile-end", "watcher-acquired"]);

			releaseWatcher();
		});

		it("tryAcquireWatcher should fail during reconcile", async () => {
			const lock = new OperationLock();

			const releaseReconcile = await lock.acquireReconcile();

			const tryResult = lock.tryAcquireWatcher();
			expect(tryResult).toBeUndefined();

			releaseReconcile();

			const tryResult2 = lock.tryAcquireWatcher();
			expect(tryResult2).toBeDefined();
			tryResult2!();
		});
	});

	describe("reconcile operations", () => {
		it("should wait for watchers to drain before reconcile", async () => {
			const lock = new OperationLock();
			const order: string[] = [];

			// Start some watchers
			const releaseW1 = await lock.acquireWatcher();
			const releaseW2 = await lock.acquireWatcher();
			order.push("watchers-started");

			// Start reconcile (should wait)
			const reconcilePromise = lock.acquireReconcile().then((release) => {
				order.push("reconcile-acquired");
				return release;
			});

			// Let microtasks run
			await Promise.resolve();
			await Promise.resolve();
			expect(order).toEqual(["watchers-started"]);

			// Release one watcher
			releaseW1();
			await Promise.resolve();
			expect(order).toEqual(["watchers-started"]);

			// Release last watcher
			releaseW2();

			// Use real timers briefly to allow the polling to complete
			vi.useRealTimers();
			await new Promise((r) => setTimeout(r, 100));
			vi.useFakeTimers();

			const releaseReconcile = await reconcilePromise;
			expect(order).toEqual(["watchers-started", "reconcile-acquired"]);

			releaseReconcile();
		});

		it("should queue multiple reconcile requests", async () => {
			const lock = new OperationLock();
			const order: string[] = [];

			const release1 = await lock.acquireReconcile();
			order.push("R1-start");

			const promise2 = lock.acquireReconcile().then((release) => {
				order.push("R2-start");
				return release;
			});

			const promise3 = lock.acquireReconcile().then((release) => {
				order.push("R3-start");
				return release;
			});

			await Promise.resolve();
			expect(order).toEqual(["R1-start"]);

			release1();
			const release2 = await promise2;
			expect(order).toEqual(["R1-start", "R2-start"]);

			release2();
			const release3 = await promise3;
			expect(order).toEqual(["R1-start", "R2-start", "R3-start"]);

			release3();
			expect(lock.getMode()).toBe("idle");
		});
	});

	describe("mode transitions", () => {
		it("should transition idle -> watching -> idle", async () => {
			const lock = new OperationLock();

			expect(lock.getMode()).toBe("idle");

			const release = await lock.acquireWatcher();
			expect(lock.getMode()).toBe("watching");

			release();
			expect(lock.getMode()).toBe("idle");
		});

		it("should transition idle -> reconciling -> idle", async () => {
			const lock = new OperationLock();

			expect(lock.getMode()).toBe("idle");

			const release = await lock.acquireReconcile();
			expect(lock.getMode()).toBe("reconciling");

			release();
			expect(lock.getMode()).toBe("idle");
		});
	});
});
