import { describe, it, expect, vi } from "vitest";
import { TypedStorage } from "../../src/utils/TypedStorage";
import type { IStorageProvider } from "../../src/utils/types";

function createMockStorage(initial: Record<string, unknown> = {}): {
	storage: IStorageProvider;
	getData: () => Record<string, unknown>;
} {
	let data = { ...initial };
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (d: unknown) => { data = d as Record<string, unknown>; }),
		},
		getData: () => data,
	};
}

describe("TypedStorage", () => {
	describe("load", () => {
		it("should return undefined when key does not exist", async () => {
			const { storage } = createMockStorage();
			const typed = new TypedStorage<{ count: number }>(storage, "myKey");
			expect(await typed.load()).toBeUndefined();
		});

		it("should return stored value when key exists", async () => {
			const { storage } = createMockStorage({ myKey: { count: 42 } });
			const typed = new TypedStorage<{ count: number }>(storage, "myKey");
			const result = await typed.load();
			expect(result).toEqual({ count: 42 });
		});

		it("should return undefined when storage returns null", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => null),
				save: vi.fn(),
			};
			const typed = new TypedStorage<string>(storage, "key");
			expect(await typed.load()).toBeUndefined();
		});

		it("should not affect other keys", async () => {
			const { storage, getData } = createMockStorage({ other: "preserved", myKey: "value" });
			const typed = new TypedStorage<string>(storage, "myKey");
			const result = await typed.load();
			expect(result).toBe("value");
			expect(getData().other).toBe("preserved");
		});
	});

	describe("save", () => {
		it("should save state under the configured key", async () => {
			const { storage, getData } = createMockStorage();
			const typed = new TypedStorage<{ count: number }>(storage, "myKey");

			await typed.save({ count: 99 });

			expect(getData().myKey).toEqual({ count: 99 });
		});

		it("should preserve other keys when saving", async () => {
			const { storage, getData } = createMockStorage({ otherService: { data: true } });
			const typed = new TypedStorage<string>(storage, "myKey");

			await typed.save("hello");

			expect(getData().myKey).toBe("hello");
			expect(getData().otherService).toEqual({ data: true });
		});

		it("should overwrite previous value", async () => {
			const { storage, getData } = createMockStorage({ myKey: "old" });
			const typed = new TypedStorage<string>(storage, "myKey");

			await typed.save("new");

			expect(getData().myKey).toBe("new");
		});

		it("should work with empty initial storage", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => null),
				save: vi.fn(),
			};
			const typed = new TypedStorage<{ x: number }>(storage, "key");

			await typed.save({ x: 1 });

			expect(storage.save).toHaveBeenCalledWith({ key: { x: 1 } });
		});
	});

	describe("safeLoad", () => {
		it("should return loaded value on success", async () => {
			const { storage } = createMockStorage({ myKey: { count: 10 } });
			const typed = new TypedStorage<{ count: number }>(storage, "myKey");
			const result = await typed.safeLoad({ count: 0 });
			expect(result).toEqual({ count: 10 });
		});

		it("should return fallback when load throws", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => { throw new Error("disk failure"); }),
				save: vi.fn(),
			};
			const typed = new TypedStorage<{ count: number }>(storage, "myKey");
			const result = await typed.safeLoad({ count: 0 });
			expect(result).toEqual({ count: 0 });
		});

		it("should call onFallback callback when load throws", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => { throw new Error("corrupt"); }),
				save: vi.fn(),
			};
			const onFallback = vi.fn();
			const typed = new TypedStorage<string>(storage, "myKey", { onFallback });
			await typed.safeLoad("default");
			expect(onFallback).toHaveBeenCalledWith("myKey", expect.any(Error));
		});

		it("should not call onFallback on successful load", async () => {
			const { storage } = createMockStorage({ myKey: "ok" });
			const onFallback = vi.fn();
			const typed = new TypedStorage<string>(storage, "myKey", { onFallback });
			await typed.safeLoad("default");
			expect(onFallback).not.toHaveBeenCalled();
		});
	});

	describe("safeSave", () => {
		it("should return true on success", async () => {
			const { storage } = createMockStorage();
			const typed = new TypedStorage<string>(storage, "myKey");
			const result = await typed.safeSave("value");
			expect(result).toBe(true);
		});

		it("should return false when save throws", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => ({})),
				save: vi.fn(async () => { throw new Error("write failure"); }),
			};
			const typed = new TypedStorage<string>(storage, "myKey");
			const result = await typed.safeSave("value");
			expect(result).toBe(false);
		});
	});

	describe("save with non-object storage data", () => {
		it("should handle storage returning an array gracefully", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => [1, 2, 3]),
				save: vi.fn(),
			};
			const typed = new TypedStorage<string>(storage, "key");
			await typed.save("value");
			expect(storage.save).toHaveBeenCalledWith({ key: "value" });
		});

		it("should handle storage returning a string gracefully", async () => {
			const storage: IStorageProvider = {
				load: vi.fn(async () => "not-an-object"),
				save: vi.fn(),
			};
			const typed = new TypedStorage<number>(storage, "key");
			await typed.save(42);
			expect(storage.save).toHaveBeenCalledWith({ key: 42 });
		});
	});

	describe("isolation", () => {
		it("should scope two TypedStorage instances to different keys", async () => {
			const { storage, getData } = createMockStorage();
			const storageA = new TypedStorage<string>(storage, "a");
			const storageB = new TypedStorage<number>(storage, "b");

			await storageA.save("hello");
			await storageB.save(42);

			expect(getData().a).toBe("hello");
			expect(getData().b).toBe(42);
			expect(await storageA.load()).toBe("hello");
			expect(await storageB.load()).toBe(42);
		});
	});
});
