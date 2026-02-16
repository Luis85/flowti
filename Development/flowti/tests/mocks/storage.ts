/**
 * Shared mock factories for ITypedStorage.
 *
 * Replaces 13+ identical `createMockStorage()` / `createMockTypedStorage()`
 * definitions that were duplicated across domain test files.
 */

import { vi } from "vitest";
import type { ITypedStorage } from "../../src/utils/TypedStorage";

/**
 * Creates a mock ITypedStorage with in-memory persistence.
 *
 * Returns the storage instance plus a `getData` helper for
 * inspecting persisted state without going through mocks.
 *
 * @example
 * const { storage, getData } = createMockStorage<MyState>();
 * const service = new MyService(storage);
 * await service.save({ key: "value" });
 * expect(getData()).toEqual({ key: "value" });
 */
export function createMockStorage<T>(initialState?: T): {
	storage: ITypedStorage<T>;
	getData: () => T | undefined;
} {
	let data: T | undefined = initialState
		? { ...initialState }
		: undefined;
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (state: T) => {
				data = state;
			}),
			safeLoad: vi.fn(async () => data),
			safeSave: vi.fn(async (state: T) => {
				data = state;
				return true;
			}),
		},
		getData: () => data,
	};
}
