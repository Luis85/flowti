import { describe, it, expect } from "vitest";
import { createTaskPool } from "../../src/infrastructure/task-concurrency.js";
import type { ITaskPool } from "../../src/infrastructure/task-concurrency.js";

describe("createTaskPool", () => {
	describe("acquire()", () => {
		it("allows up to maxConcurrent agents", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			expect(pool.acquire("Alice")).toBe(true);
			expect(pool.acquire("Bob")).toBe(true);
		});

		it("rejects when at capacity", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			pool.acquire("Alice");
			pool.acquire("Bob");
			expect(pool.acquire("Charlie")).toBe(false);
		});

		it("allows acquire after releasing a slot", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.acquire("Alice");
			pool.release("Alice");
			expect(pool.acquire("Bob")).toBe(true);
		});

		it("increments active count on success", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 3 });
			pool.acquire("Alice");
			pool.acquire("Bob");
			expect(pool.getActiveCount()).toBe(2);
		});

		it("does not increment active count on failure", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.acquire("Alice");
			pool.acquire("Bob"); // fails
			expect(pool.getActiveCount()).toBe(1);
		});
	});

	describe("release()", () => {
		it("decrements active count", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			pool.acquire("Alice");
			pool.acquire("Bob");
			pool.release("Alice");
			expect(pool.getActiveCount()).toBe(1);
		});

		it("does nothing for an agent that is not active (no throw)", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			expect(() => pool.release("nobody")).not.toThrow();
		});

		it("opens a slot for the next acquire", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.acquire("Alice");
			expect(pool.acquire("Bob")).toBe(false);
			pool.release("Alice");
			expect(pool.acquire("Bob")).toBe(true);
		});
	});

	describe("enqueue()", () => {
		it("adds an agent to the waiting queue", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.acquire("Alice");
			pool.enqueue("Bob");
			expect(pool.getQueuedAgents()).toContain("Bob");
		});

		it("does not add duplicates to the queue", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.enqueue("Alice");
			pool.enqueue("Alice");
			expect(pool.getQueuedAgents()).toHaveLength(1);
		});

		it("maintains multiple distinct entries in order", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.enqueue("Alice");
			pool.enqueue("Bob");
			pool.enqueue("Charlie");
			const queued = pool.getQueuedAgents();
			expect(queued).toEqual(["Alice", "Bob", "Charlie"]);
		});
	});

	describe("dequeueNext()", () => {
		it("returns null when queue is empty", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			expect(pool.dequeueNext()).toBeNull();
		});

		it("returns null when at capacity", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 1 });
			pool.acquire("Alice");
			pool.enqueue("Bob");
			expect(pool.dequeueNext()).toBeNull();
		});

		it("returns next agent when a slot is available", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			pool.enqueue("Alice");
			expect(pool.dequeueNext()).toBe("Alice");
		});

		it("dequeues in FIFO order", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			pool.enqueue("First");
			pool.enqueue("Second");
			pool.enqueue("Third");

			// Dequeue and acquire in order to fill slots
			const a = pool.dequeueNext();
			expect(a).toBe("First");
			pool.acquire(a!);

			const b = pool.dequeueNext();
			expect(b).toBe("Second");
			pool.acquire(b!);

			// Pool is now at capacity — dequeueNext returns null
			expect(pool.dequeueNext()).toBeNull();

			// After releasing a slot, Third can be dequeued
			pool.release("First");
			expect(pool.dequeueNext()).toBe("Third");
		});

		it("removes the dequeued agent from the queue", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			pool.enqueue("Alice");
			pool.enqueue("Bob");
			pool.dequeueNext();
			expect(pool.getQueuedAgents()).not.toContain("Alice");
			expect(pool.getQueuedAgents()).toContain("Bob");
		});
	});

	describe("getQueuedAgents()", () => {
		it("returns an empty array when nothing is queued", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			expect(pool.getQueuedAgents()).toHaveLength(0);
		});

		it("returns a snapshot that does not mutate the internal queue", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 2 });
			pool.enqueue("Alice");
			const snapshot = pool.getQueuedAgents();
			pool.enqueue("Bob");
			expect(snapshot).toHaveLength(1);
		});
	});

	describe("getActiveCount()", () => {
		it("starts at 0", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 3 });
			expect(pool.getActiveCount()).toBe(0);
		});

		it("reflects current active slot count", () => {
			const pool: ITaskPool = createTaskPool({ maxConcurrent: 3 });
			pool.acquire("A");
			pool.acquire("B");
			pool.release("A");
			expect(pool.getActiveCount()).toBe(1);
		});
	});

	describe("default config", () => {
		it("defaults to maxConcurrent of 2", () => {
			const pool: ITaskPool = createTaskPool();
			expect(pool.acquire("Alice")).toBe(true);
			expect(pool.acquire("Bob")).toBe(true);
			expect(pool.acquire("Charlie")).toBe(false);
		});
	});
});
