import { describe, it, expect } from "vitest";
import { PathMutex } from "../../src/utils/mutex";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PathMutex", () => {
	it("should serialize access to the same path", async () => {
		const mutex = new PathMutex();
		const order: number[] = [];

		const p1 = mutex.withLock("/a", async () => {
			order.push(1);
			await delay(50);
			order.push(2);
		});

		const p2 = mutex.withLock("/a", async () => {
			order.push(3);
			await delay(10);
			order.push(4);
		});

		await Promise.all([p1, p2]);
		expect(order).toEqual([1, 2, 3, 4]);
	});

	it("should allow parallel access to different paths", async () => {
		const mutex = new PathMutex();
		const order: string[] = [];

		const p1 = mutex.withLock("/a", async () => {
			order.push("a-start");
			await delay(50);
			order.push("a-end");
		});

		const p2 = mutex.withLock("/b", async () => {
			order.push("b-start");
			await delay(10);
			order.push("b-end");
		});

		await Promise.all([p1, p2]);
		expect(order[0]).toBe("a-start");
		expect(order[1]).toBe("b-start");
		// b finishes first since it's shorter and runs in parallel
		expect(order[2]).toBe("b-end");
		expect(order[3]).toBe("a-end");
	});

	it("should return the value from the callback", async () => {
		const mutex = new PathMutex();
		const result = await mutex.withLock("/x", async () => 42);
		expect(result).toBe(42);
	});

	it("should release lock on error", async () => {
		const mutex = new PathMutex();

		await expect(
			mutex.withLock("/a", async () => {
				throw new Error("fail");
			})
		).rejects.toThrow("fail");

		// Should still be able to acquire the lock after error
		const result = await mutex.withLock("/a", async () => "ok");
		expect(result).toBe("ok");
	});

	it("should handle triple serialization", async () => {
		const mutex = new PathMutex();
		const order: number[] = [];

		const p1 = mutex.withLock("/a", async () => {
			order.push(1);
			await delay(20);
		});
		const p2 = mutex.withLock("/a", async () => {
			order.push(2);
			await delay(20);
		});
		const p3 = mutex.withLock("/a", async () => {
			order.push(3);
		});

		await Promise.all([p1, p2, p3]);
		expect(order).toEqual([1, 2, 3]);
	});
});
