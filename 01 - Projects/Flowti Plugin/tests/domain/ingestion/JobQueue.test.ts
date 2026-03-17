import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobQueue } from "../../../src/domain/ingestion/JobQueue";

describe("JobQueue", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should process items in order", async () => {
		const processed: number[] = [];
		const queue = new JobQueue<number>(1, async (item) => {
			processed.push(item);
		});

		queue.enqueue(1);
		queue.enqueue(2);
		queue.enqueue(3);

		await queue.drain();
		expect(processed).toEqual([1, 2, 3]);
	});

	it("should respect concurrency limit", async () => {
		let maxConcurrent = 0;
		let current = 0;

		const queue = new JobQueue<number>(2, async () => {
			current++;
			maxConcurrent = Math.max(maxConcurrent, current);
			await new Promise((resolve) => setTimeout(resolve, 10));
			current--;
		});

		queue.enqueue(1);
		queue.enqueue(2);
		queue.enqueue(3);
		queue.enqueue(4);

		const drainPromise = queue.drain();
		await vi.advanceTimersByTimeAsync(100);
		await drainPromise;

		expect(maxConcurrent).toBe(2);
	});

	it("should report correct size", () => {
		const queue = new JobQueue<number>(1, async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		expect(queue.size).toBe(0);
		queue.enqueue(1);
		queue.enqueue(2);
		// First item starts processing immediately, second stays in queue
		expect(queue.size).toBe(1);
	});

	it("should report correct activeCount", () => {
		const queue = new JobQueue<number>(2, async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		expect(queue.activeCount).toBe(0);
		queue.enqueue(1);
		queue.enqueue(2);
		expect(queue.activeCount).toBe(2);
	});

	it("should be idle when empty", () => {
		const queue = new JobQueue<number>(1, async () => {});
		expect(queue.isIdle).toBe(true);
	});

	it("should not be idle while processing", () => {
		const queue = new JobQueue<number>(1, async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		queue.enqueue(1);
		expect(queue.isIdle).toBe(false);
	});

	it("should resolve drain immediately when idle", async () => {
		const queue = new JobQueue<number>(1, async () => {});
		await queue.drain(); // Should resolve immediately
	});

	it("should handle errors without crashing the queue", async () => {
		const processed: number[] = [];
		const queue = new JobQueue<number>(1, async (item) => {
			if (item === 2) throw new Error("fail");
			processed.push(item);
		});

		queue.enqueue(1);
		queue.enqueue(2);
		queue.enqueue(3);

		await queue.drain();
		// Item 1 and 3 should process; item 2 throws but doesn't block queue
		expect(processed).toEqual([1, 3]);
	});

	it("should process items concurrently up to limit", async () => {
		const order: string[] = [];

		const queue = new JobQueue<number>(3, async (item) => {
			order.push(`start-${item}`);
			await new Promise((resolve) => setTimeout(resolve, item * 10));
			order.push(`end-${item}`);
		});

		queue.enqueue(1);
		queue.enqueue(2);
		queue.enqueue(3);

		const drainPromise = queue.drain();
		await vi.advanceTimersByTimeAsync(100);
		await drainPromise;

		// All should start before any finishes (with concurrency 3)
		expect(order[0]).toBe("start-1");
		expect(order[1]).toBe("start-2");
		expect(order[2]).toBe("start-3");
	});

	it("should call the processor for each item", async () => {
		const processor = vi.fn(async () => {});
		const queue = new JobQueue<string>(2, processor);

		queue.enqueue("a");
		queue.enqueue("b");
		queue.enqueue("c");

		await queue.drain();
		expect(processor).toHaveBeenCalledTimes(3);
		expect(processor).toHaveBeenCalledWith("a");
		expect(processor).toHaveBeenCalledWith("b");
		expect(processor).toHaveBeenCalledWith("c");
	});
});
