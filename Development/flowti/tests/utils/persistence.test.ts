import { describe, it, expect, vi } from "vitest";
import type { IStorageProvider } from "../../src/utils/types";
import {
	loadStateFromStorage,
	saveStateToStorage,
	safeLoadState,
	safeSaveState,
} from "../../src/utils/persistence";

function createMockStorage(data: unknown = null): IStorageProvider {
	let stored = data;
	return {
		load: vi.fn(async () => stored),
		save: vi.fn(async (d: unknown) => {
			stored = d;
		}),
	};
}

describe("loadStateFromStorage", () => {
	it("should return the value at the given key", async () => {
		const storage = createMockStorage({ myKey: { foo: "bar" } });
		const result = await loadStateFromStorage<{ foo: string }>(storage, "myKey");
		expect(result).toEqual({ foo: "bar" });
	});

	it("should return undefined for missing key", async () => {
		const storage = createMockStorage({ other: 1 });
		expect(await loadStateFromStorage(storage, "myKey")).toBeUndefined();
	});

	it("should return undefined for null storage", async () => {
		const storage = createMockStorage(null);
		expect(await loadStateFromStorage(storage, "myKey")).toBeUndefined();
	});
});

describe("saveStateToStorage", () => {
	it("should merge state into existing data", async () => {
		const storage = createMockStorage({ existing: true });
		await saveStateToStorage(storage, "newKey", { value: 42 });
		expect(storage.save).toHaveBeenCalledWith({
			existing: true,
			newKey: { value: 42 },
		});
	});

	it("should handle empty storage", async () => {
		const storage = createMockStorage(null);
		await saveStateToStorage(storage, "key", "data");
		expect(storage.save).toHaveBeenCalledWith({ key: "data" });
	});
});

describe("safeLoadState", () => {
	it("should return data on success", async () => {
		const storage = createMockStorage({ key: { x: 1 } });
		expect(await safeLoadState<{ x: number }>(storage, "key")).toEqual({ x: 1 });
	});

	it("should return undefined on error", async () => {
		const storage: IStorageProvider = {
			load: vi.fn(async () => { throw new Error("disk error"); }),
			save: vi.fn(),
		};
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await safeLoadState(storage, "key")).toBeUndefined();
		expect(spy).toHaveBeenCalledWith(
			'[Flowti] Failed to load state for key "key":',
			expect.any(Error),
		);
		spy.mockRestore();
	});

	it("should return fallback on error", async () => {
		const storage: IStorageProvider = {
			load: vi.fn(async () => { throw new Error("fail"); }),
			save: vi.fn(),
		};
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const fallback = { default: true };
		expect(await safeLoadState(storage, "key", fallback)).toBe(fallback);
		spy.mockRestore();
	});
});

describe("safeSaveState", () => {
	it("should return true on success", async () => {
		const storage = createMockStorage({});
		expect(await safeSaveState(storage, "key", "value")).toBe(true);
	});

	it("should return false on error", async () => {
		const storage: IStorageProvider = {
			load: vi.fn(async () => ({})),
			save: vi.fn(async () => { throw new Error("write error"); }),
		};
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await safeSaveState(storage, "key", "value")).toBe(false);
		expect(spy).toHaveBeenCalledWith(
			'[Flowti] Failed to save state for key "key":',
			expect.any(Error),
		);
		spy.mockRestore();
	});
});
