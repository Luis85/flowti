/**
 * mock-fs.ts — In-memory IFileSystem for tests.
 *
 * Usage:
 *   const fs = createMockFs({ "/path/to/file.json": '{"key": "value"}' });
 *   fs.readFileSync("/path/to/file.json", "utf-8"); // '{"key": "value"}'
 */

import type { IFileSystem, DirEntry } from "../../src/infrastructure/types.js";
import type fs from "node:fs";
import path from "node:path";

type NonSharedBuffer = Buffer & { buffer: SharedArrayBuffer extends ArrayBuffer ? never : ArrayBuffer };

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

	function readFileSyncImpl(filePath: string, encoding?: BufferEncoding): string | NonSharedBuffer {
		const key = normalize(filePath);
		if (!fileMap.has(key)) throw new Error(`ENOENT: no such file: ${key}`);
		const content = fileMap.get(key)!;
		if (encoding) return content;
		return Buffer.from(content) as NonSharedBuffer;
	}

	function readdirSyncImpl(dirPath: string, options?: { withFileTypes: true }): string[] | DirEntry[] {
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
	}

	function statSyncImpl(filePath: string): fs.Stats {
		const key = normalize(filePath);
		if (fileMap.has(key)) {
			return { size: fileMap.get(key)!.length, isFile: () => true, isDirectory: () => false } as unknown as fs.Stats;
		}
		if (dirSet.has(key)) {
			return { size: 0, isFile: () => false, isDirectory: () => true } as unknown as fs.Stats;
		}
		throw new Error(`ENOENT: no such file: ${key}`);
	}

	const mock = {
		files: fileMap,
		dirs: dirSet,

		readFileSync: readFileSyncImpl as IFileSystem["readFileSync"],

		writeFileSync(filePath: string, content: string, _encoding?: BufferEncoding): void {
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

		readdirSync: readdirSyncImpl as IFileSystem["readdirSync"],

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

		statSync: statSyncImpl as IFileSystem["statSync"],
	};

	return mock as IFileSystem & { files: Map<string, string>; dirs: Set<string> };
}
