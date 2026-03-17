/**
 * Shared mock factories for IFileSystemClient.
 *
 * Replaces 15+ identical `createMockFileSystem()` definitions
 * that were duplicated across domain and UI test files.
 */

import { vi } from "vitest";
import type { IFileSystemClient } from "../../src/infrastructure/filesystem/types";

/**
 * Creates a mock file system backed by an in-memory Map.
 *
 * Supports pre-populating files via `existingFiles`.
 * All methods are vi.fn() spies, so they can be asserted on.
 *
 * @example
 * const fs = createMockFileSystem({ "notes/foo.md": "# Foo" });
 * expect(await fs.fileExists("notes/foo.md")).toBe(true);
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
		listFiles: vi.fn(async (folderPath: string) => {
			return [...files.keys()].filter((p) => p.startsWith(folderPath + "/"));
		}),
		ensureFolder: vi.fn(async () => {}),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async (_p: string, d: Record<string, unknown>) => d),
		setFrontmatter: vi.fn(async () => undefined),
	} as unknown as IFileSystemClient;
}

/**
 * Creates a minimal file system stub where all methods return defaults.
 *
 * Use this when tests don't need in-memory file persistence but
 * need to satisfy IFileSystemClient type requirements.
 *
 * @example
 * const fs = createMockFileSystemStub();
 * // Override specific behavior:
 * (fs.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
 */
export function createMockFileSystemStub(): IFileSystemClient {
	return {
		fileExists: vi.fn(async () => false),
		createFile: vi.fn(async () => {}),
		readFile: vi.fn(async () => { throw new Error("File not found"); }),
		updateFile: vi.fn(async () => {}),
		deleteFile: vi.fn(async () => {}),
		moveFile: vi.fn(async (_p: string, np: string) => np),
		renameFile: vi.fn(async (_p: string, nn: string) => nn),
		listFiles: vi.fn(async () => []),
		ensureFolder: vi.fn(async () => {}),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async (_p: string, d: Record<string, unknown>) => d),
		setFrontmatter: vi.fn(async () => {}),
	} as unknown as IFileSystemClient;
}
