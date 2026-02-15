/**
 * Shared mock factories for flow integration tests.
 *
 * Provides typed mock storage and file system factories that
 * follow the same patterns used in domain service tests.
 */

import { vi } from "vitest";
import type { ITypedStorage } from "../../src/utils/TypedStorage";
import type { IFileSystemClient } from "../../src/infrastructure/filesystem/types";

/**
 * Creates a generic mock typed storage with in-memory persistence.
 */
export function createMockStorage<T>(initialState?: T): {
	storage: ITypedStorage<T>;
	getData: () => T | undefined;
} {
	let data: T | undefined = initialState;
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

/**
 * Creates a mock file system with an in-memory file store.
 */
export function createMockFileSystem(existingFiles: Record<string, string> = {}): IFileSystemClient {
	const files = new Map(Object.entries(existingFiles));
	return {
		fileExists: vi.fn(async (path: string) => files.has(path)),
		createFile: vi.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		readFile: vi.fn(async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		}),
		updateFile: vi.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		deleteFile: vi.fn(async (path: string) => {
			files.delete(path);
		}),
		moveFile: vi.fn(async (_p: string, np: string) => np),
		renameFile: vi.fn(async (_p: string, nn: string) => nn),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async (_p: string, d: Record<string, unknown>) => d),
		setFrontmatter: vi.fn(async () => undefined),
	} as unknown as IFileSystemClient;
}

/**
 * Collects event types emitted on the bus in order.
 */
export function collectEvents(eventBus: { on: (type: string, handler: (e: { type: string }) => void) => void }, pattern: string): string[] {
	const events: string[] = [];
	eventBus.on(pattern, (e: { type: string }) => {
		events.push(e.type);
	});
	return events;
}

/**
 * Wait for async handlers to complete.
 */
export function waitForAsync(ms = 50): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
