/**
 * mock-fs.ts — In-memory IFileSystem for tests.
 *
 * Usage:
 *   const fs = createMockFs({ "/path/to/file.json": '{"key": "value"}' });
 *   fs.readFileSync("/path/to/file.json", "utf-8"); // '{"key": "value"}'
 */

import type { IFileSystem, DirEntry } from "../../src/types.js";
import path from "node:path";

export function createMockFs(files: Record<string, string> = {}): IFileSystem & {
	files: Map<string, string>;
	dirs: Set<string>;
} {
	const fileMap = new Map(Object.entries(files).map(([k, v]) => [normalize(k), v]));
	const dirSet = new Set<string>();

	// Seed dirs from file paths
	for (const filePath of fileMap.keys()) {
		let dir = path.dirname(filePath);
		while (dir !== path.dirname(dir)) {
			dirSet.add(dir);
			dir = path.dirname(dir);
		}
	}

	function normalize(p: string): string {
		return p.replace(/\\/g, "/");
	}

	const mock: IFileSystem & { files: Map<string, string>; dirs: Set<string> } = {
		files: fileMap,
		dirs: dirSet,

		readFileSync(filePath: string): string {
			const key = normalize(filePath);
			if (!fileMap.has(key)) throw new Error(`ENOENT: no such file: ${key}`);
			return fileMap.get(key)!;
		},

		writeFileSync(filePath: string, content: string): void {
			const key = normalize(filePath);
			fileMap.set(key, content);
			let dir = path.dirname(key);
			while (dir !== path.dirname(dir)) {
				dirSet.add(dir);
				dir = path.dirname(dir);
			}
		},

		existsSync(filePath: string): boolean {
			const key = normalize(filePath);
			return fileMap.has(key) || dirSet.has(key);
		},

		mkdirSync(dirPath: string): void {
			let dir = normalize(dirPath);
			while (dir !== path.dirname(dir)) {
				dirSet.add(dir);
				dir = path.dirname(dir);
			}
		},

		readdirSync(dirPath: string, options?: { withFileTypes: true }): string[] | DirEntry[] {
			const dir = normalize(dirPath);
			const entries = new Map<string, "file" | "dir">();

			for (const key of fileMap.keys()) {
				if (path.dirname(key) === dir) {
					entries.set(path.basename(key), "file");
				}
			}
			for (const key of dirSet) {
				if (path.dirname(key) === dir && key !== dir) {
					entries.set(path.basename(key), "dir");
				}
			}

			if (options?.withFileTypes) {
				return [...entries.entries()].map(([name, type]): DirEntry => ({
					name,
					isDirectory: () => type === "dir",
					isFile: () => type === "file",
				}));
			}
			return [...entries.keys()];
		},

		copyFileSync(src: string, dest: string): void {
			const content = mock.readFileSync(src, "utf-8");
			mock.writeFileSync(dest, content, "utf-8");
		},

		rmSync(filePath: string): void {
			fileMap.delete(normalize(filePath));
		},

		unlinkSync(filePath: string): void {
			fileMap.delete(normalize(filePath));
		},

		statSync(filePath: string): { size: number; isFile(): boolean; isDirectory(): boolean } {
			const key = normalize(filePath);
			if (fileMap.has(key)) {
				return { size: fileMap.get(key)!.length, isFile: () => true, isDirectory: () => false };
			}
			if (dirSet.has(key)) {
				return { size: 0, isFile: () => false, isDirectory: () => true };
			}
			throw new Error(`ENOENT: no such file: ${key}`);
		},
	};

	return mock;
}
